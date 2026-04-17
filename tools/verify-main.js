import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promises as fsPromises } from "node:fs";
import baseConfig from "../scripts/config/mihomo-preset/base.js";
import dnsConfig from "../scripts/config/mihomo-preset/dns.js";
import geodataConfig from "../scripts/config/mihomo-preset/geodata.js";
import profileConfig from "../scripts/config/mihomo-preset/profile.js";
import chainsConfig from "../scripts/config/proxy-groups/chains.js";
import groupDefinitionsConfig from "../scripts/config/proxy-groups/groupDefinitions.js";
import inlineRulesConfig from "../scripts/config/rules/inlineRules.js";
import ruleProvidersConfig from "../scripts/config/rules/ruleProviders.js";
import regionsConfig from "../scripts/config/proxy-groups/regions.js";
import placeholdersConfig from "../scripts/config/proxy-groups/placeholders.js";
import snifferConfig from "../scripts/config/mihomo-preset/sniffer.js";
import tunConfig from "../scripts/config/mihomo-preset/tun.js";
import { assembleRuleSet } from "../scripts/override/lib/rule-assembly.js";
import {
  applyProxyChains,
  buildChainGroups,
  buildTransitGroups,
  validateChainsSchema,
} from "../scripts/override/lib/proxy-chains.js";
import { buildProxyGroups } from "../scripts/override/lib/proxy-groups.js";
import { applyRuntimePreset } from "../scripts/override/lib/runtime-preset.js";
import { validateOutput } from "../scripts/override/lib/validate-output.js";
import {
  loadBundleRuntime,
  loadTemplateProxies,
  stringifyExampleConfig,
} from "./lib/bundle-runtime.js";
import { buildYamlModules } from "./yaml-to-js.js";
import {
  REPO_ROOT,
  DEFINITIONS_DIR,
  SCRIPTS_CONFIG_DIR,
  CANONICAL_NAMESPACES,
} from "./lib/paths.js";

/**
 * 将值转换为稳定的 JSON 结构，便于断言时规避原型与引用差异。
 * @param {unknown} value 待规范化的任意值。
 * @returns {unknown} 仅包含 JSON 可序列化数据的副本。
 */
function normalize(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 在临时目录中复制 definitions/，执行回调后自动清理。
 * 用于验证 yaml-to-js 的构建行为，避免污染当前仓库工作区。
 * @template T
 * @param {(workspaceRoot: string) => Promise<T>} callback - 接收临时工作区根目录的异步回调。
 * @returns {Promise<T>} 回调返回值。
 */
async function withTempDefinitionsWorkspace(callback) {
  const workspaceRoot = await fsPromises.mkdtemp(
    path.join(os.tmpdir(), "proxy-config-hub-verify-"),
  );

  await fsPromises.cp(DEFINITIONS_DIR, path.join(workspaceRoot, "definitions"), {
    recursive: true,
  });

  try {
    return await callback(workspaceRoot);
  } finally {
    await fsPromises.rm(workspaceRoot, { recursive: true, force: true });
  }
}

/**
 * 读取文本文件并写回变换后的内容。
 * 若变换结果与原文一致则立即失败，避免测试误以为已注入故障场景。
 * @param {string} filePath - 待修改文件的绝对路径。
 * @param {(sourceText: string) => string} transform - 文本变换函数。
 * @returns {Promise<void>}
 */
async function transformTextFile(filePath, transform) {
  const sourceText = await fsPromises.readFile(filePath, "utf8");
  const nextText = transform(sourceText);

  assert.notEqual(nextText, sourceText, `测试未能修改目标文件: ${filePath}`);
  await fsPromises.writeFile(filePath, nextText, "utf8");
}

/**
 * 断言 bundle 结果中指定 runtime 分段与当前生成配置一致。
 * @param {Record<string, unknown>} result bundle 输出配置。
 * @param {Record<string, unknown>} expectedSection 期望的分段配置。
 * @param {string} label 当前断言的语义标签。
 * @returns {void}
 */
function assertSectionApplied(result, expectedSection, label) {
  for (const [key, value] of Object.entries(expectedSection)) {
    assert.deepEqual(
      normalize(result[key]),
      normalize(value),
      `${label} 应应用当前生成配置中的 ${key}`,
    );
  }
}

/**
 * 移除 rule-provider 定义中不应泄漏到最终输出的元数据字段。
 * @param {Record<string, unknown>} providerDefinition 单个 provider 定义。
 * @returns {Record<string, unknown>} 剔除元数据后的 provider 配置。
 */
function stripProviderMetadata(providerDefinition) {
  assert.ok(
    providerDefinition && typeof providerDefinition === "object" && !Array.isArray(providerDefinition),
    "providerDefinition 必须为对象",
  );

  const strippedProvider = {};

  for (const [key, value] of Object.entries(providerDefinition)) {
    if (key === "target-group" || key === "no-resolve") {
      continue;
    }

    strippedProvider[key] = value;
  }

  return strippedProvider;
}

/**
 * 基于 scripts/config 生成独立的期望规则快照，并在执行 bundle 前完成配置预校验。
 * @param {Record<string, { name?: string }>} groupDefinitions 策略组定义。
 * @param {Record<string, Record<string, unknown>>} ruleProviders rule-provider 定义。
 * @param {string[]} prependRules 需要前置插入的规则数组。
 * @returns {{
 *   expectedProviderIds: string[],
 *   expectedProviders: Record<string, Record<string, unknown>>,
 *   expectedRuleSetRules: string[],
 *   fallbackRule: string,
 *   prependRules: string[],
 * }} 独立推导出的 provider 与规则期望快照。
 */
function buildExpectedRuleSnapshot(groupDefinitions, ruleProviders, prependRules) {
  assert.ok(
    groupDefinitions && typeof groupDefinitions === "object" && !Array.isArray(groupDefinitions),
    "groupDefinitions 必须为对象",
  );
  assert.ok(
    ruleProviders && typeof ruleProviders === "object" && !Array.isArray(ruleProviders),
    "ruleProviders 必须为对象",
  );
  assert.ok(Array.isArray(prependRules), "prependRules 必须为数组");

  const normalizedPrependRules = [...prependRules];
  const fallbackGroupId = placeholdersConfig.fallback;
  const fallbackGroupName = groupDefinitions?.[fallbackGroupId]?.name;

  assert.ok(
    typeof fallbackGroupName === "string" && fallbackGroupName.length > 0,
    `groupDefinitions[${fallbackGroupId}].name 必须已定义`,
  );

  const expectedProviders = {};
  const expectedRuleSetRules = [];
  const expectedProviderIds = [];

  for (const [providerId, providerDefinition] of Object.entries(ruleProviders)) {
    const targetGroupId = providerDefinition?.["target-group"];
    const targetGroupName = groupDefinitions?.[targetGroupId]?.name;

    if (typeof targetGroupId !== "string" || targetGroupId.length === 0) {
      throw new Error(`rule-provider ${providerId} 缺少合法的 target-group`);
    }

    if (typeof targetGroupName !== "string" || targetGroupName.length === 0) {
      throw new Error(`rule-provider ${providerId} 引用了未定义的 target-group: ${targetGroupId}`);
    }

    expectedProviderIds.push(providerId);
    expectedProviders[providerId] = stripProviderMetadata(providerDefinition);
    expectedRuleSetRules.push(
      providerDefinition["no-resolve"]
        ? `RULE-SET,${providerId},${targetGroupName},no-resolve`
        : `RULE-SET,${providerId},${targetGroupName}`,
    );
  }

  return {
    expectedProviderIds,
    expectedProviders,
    expectedRuleSetRules,
    fallbackRule: `MATCH,${fallbackGroupName}`,
    prependRules: normalizedPrependRules,
  };
}

/**
 * 校验 scripts/config 生成产物是否完整存在，且不会错误包含 custom 模板产物。
 * 通过扫描 definitions/ 源目录动态推导期望产物列表，新增 YAML 定义文件后无需修改此函数。
 * @returns {void}
 */
function assertGeneratedFiles() {
  for (const namespace of CANONICAL_NAMESPACES) {
    const sourceDir = path.join(DEFINITIONS_DIR, namespace.sourceSubdir);
    const outputDir = path.join(SCRIPTS_CONFIG_DIR, namespace.outputSubdir);

    if (!fs.existsSync(sourceDir)) {
      throw new Error(`缺少源定义目录: ${path.relative(REPO_ROOT, sourceDir)}`);
    }

    const yamlFiles = fs.readdirSync(sourceDir).filter((name) => /\.(ya?ml)$/i.test(name));

    for (const yamlFile of yamlFiles) {
      const expectedJs = yamlFile.replace(/\.(ya?ml)$/i, ".js");
      const expectedPath = path.join(outputDir, expectedJs);
      assert.ok(
        fs.existsSync(expectedPath),
        `缺少生成产物文件: ${path.relative(REPO_ROOT, expectedPath)}`,
      );
    }
  }

  assert.ok(
    !fs.existsSync(path.join(SCRIPTS_CONFIG_DIR, "assets")),
    "assets 命名空间不得被编译到 scripts/config",
  );
  assert.ok(
    !fs.existsSync(path.join(SCRIPTS_CONFIG_DIR, "runtime")),
    "旧 runtime 命名空间已废弃，scripts/config/ 下不应再存在 runtime 目录",
  );
}

/**
 * 校验 definitions/assets/custom 资源是否被无损复制到 dist。
 * @returns {void}
 */
function assertCustomAssetCopy() {
  const sourcePath = path.join(REPO_ROOT, "definitions", "assets", "custom", "_template.yaml");
  const distPath = path.join(REPO_ROOT, "dist", "assets", "custom", "_template.yaml");
  assert.equal(
    fs.readFileSync(distPath, "utf8"),
    fs.readFileSync(sourcePath, "utf8"),
    "custom 模板资源应被原样复制到 dist",
  );
}

/**
 * 校验主 bundle 在正常输入下的 runtime 注入、provider 输出与规则顺序。
 * @returns {void}
 */
function testBundlePositivePath() {
  const { expectedProviderIds, expectedProviders, expectedRuleSetRules, fallbackRule, prependRules } =
    buildExpectedRuleSnapshot(
      groupDefinitionsConfig.groupDefinitions,
      ruleProvidersConfig.ruleProviders,
      inlineRulesConfig.prependRules ?? [],
    );

  const { main, bundleCode } = loadBundleRuntime();
  assert.equal(typeof main, "function", "bundle 应暴露 main()");
  const result = main({ proxies: loadTemplateProxies() });

  assertSectionApplied(result, baseConfig, "base runtime 配置");
  assertSectionApplied(result, profileConfig, "profile runtime 配置");
  assertSectionApplied(result, geodataConfig, "geodata runtime 配置");
  assert.deepEqual(normalize(result.dns), normalize(dnsConfig), "dns 预设应与当前生成配置一致");
  assert.deepEqual(normalize(result.sniffer), normalize(snifferConfig), "sniffer 预设应与当前生成配置一致");
  assert.deepEqual(normalize(result.tun), normalize(tunConfig), "tun 预设应与当前生成配置一致");
  assert.ok(Array.isArray(result["proxy-groups"]) && result["proxy-groups"].length > 0, "应生成 proxy-groups");
  assert.ok(result["rule-providers"] && typeof result["rule-providers"] === "object", "应生成 rule-providers");

  const actualProviderIds = Object.keys(result["rule-providers"]).sort();
  assert.deepEqual(
    actualProviderIds,
    [...expectedProviderIds].sort(),
    "rule-providers 输出键集合应与生成配置完全一致",
  );

  for (const providerId of expectedProviderIds) {
    assert.deepEqual(
      normalize(result["rule-providers"][providerId]),
      normalize(expectedProviders[providerId]),
      `rule-provider 输出应仅移除元数据且保持内容不变: ${providerId}`,
    );
  }

  assert.ok(Array.isArray(result.rules), "应生成 rules");
  assert.equal(
    result.rules.length,
    prependRules.length + expectedProviderIds.length + 1,
    "rules 应仅包含 prependRules、provider RULE-SET 规则和一条 fallback MATCH",
  );
  assert.deepEqual(
    normalize(result.rules.slice(0, prependRules.length)),
    normalize(prependRules),
    "rules 应以 inlineRules.prependRules 的声明顺序开头",
  );
  assert.deepEqual(
    normalize(result.rules.slice(prependRules.length, -1)),
    normalize(expectedRuleSetRules),
    "provider RULE-SET 规则应严格按 ruleProviders 声明顺序排列，且 MATCH 前不得插入其它规则",
  );
  assert.equal(result.rules.at(-1), fallbackRule, "最后一条规则应为 placeholdersConfig.fallback 指向组的 MATCH");
  assert.ok(!bundleCode.includes("definitions/runtime"), "bundle 不得引用旧 definitions/runtime 路径");
  assert.ok(!bundleCode.includes("definitions/rules/registry"), "bundle 不得引用旧 definitions/rules/registry 路径");
  assert.ok(!bundleCode.includes("definitions/rules/custom"), "bundle 不得引用旧 definitions/rules/custom 路径");
}

/**
 * 端到端校验 bundle 对链式代理的处理与 chains.yaml 的配置保持一致。
 *
 * 不依赖具体的组名/正则字面量——期望结果全部从 chains.yaml（经 yaml-to-js
 * 编译后的 chains.js）与模板节点动态派生，修改 chains.yaml 中的 name/pattern
 * 后无需同步改动本测试。
 *
 * 校验规则（与 scripts/override/main.js 里 chainsEffective 判定保持对齐）：
 *   - 若 chain_group / transit_group 均能构建出至少一个非空组（chainsEffective=true）：
 *       * proxy-groups 中必须出现对应的每个 chain_group.name 与 transit_group.name
 *       * 命中某 chain.landing_pattern 的节点应被注入 dialer-proxy = 其 entry 指向
 *         的 transit_group.name（首个命中的 chain 胜出，与 buildChainGroups 一致）
 *       * 未命中任何 landing_pattern 的节点不得带 dialer-proxy
 *   - 若 chainsEffective=false：任何 chain/transit 组名都不应出现，proxies 不得带 dialer-proxy
 *
 * @returns {void}
 */
function testBundleChainsEndToEnd() {
  const { main } = loadBundleRuntime();
  const inputProxies = loadTemplateProxies();
  const result = main({ proxies: inputProxies });

  const transitDefs = Array.isArray(chainsConfig.transit_group) ? chainsConfig.transit_group : [];
  const chainDefs = Array.isArray(chainsConfig.chain_group) ? chainsConfig.chain_group : [];

  // 使用与 bundle 相同的库函数派生预期：避免重新实现匹配逻辑
  const namedProxies = inputProxies.filter(
    (proxy) => proxy && typeof proxy.name === "string" && proxy.name.trim().length > 0,
  );
  const { chainGroups, remainingProxies } = buildChainGroups(namedProxies, chainDefs);
  const { groups: transitGroups, idToName: transitIdToName } = buildTransitGroups(
    remainingProxies,
    transitDefs,
  );
  const chainsEffective = chainGroups.length > 0 && transitGroups.length > 0;

  const producedGroupNames = new Set(result["proxy-groups"].map((group) => group.name));

  if (chainsEffective) {
    for (const group of chainGroups) {
      assert.equal(
        producedGroupNames.has(group.name),
        true,
        `chainsEffective=true 时 chain_group "${group.name}" 应出现在 proxy-groups`,
      );
    }
    for (const group of transitGroups) {
      assert.equal(
        producedGroupNames.has(group.name),
        true,
        `chainsEffective=true 时 transit_group "${group.name}" 应出现在 proxy-groups`,
      );
    }
  } else {
    for (const definition of chainDefs) {
      assert.equal(
        producedGroupNames.has(definition.name),
        false,
        `chainsEffective=false 时 chain_group "${definition.name}" 不应出现`,
      );
    }
    for (const definition of transitDefs) {
      assert.equal(
        producedGroupNames.has(definition.name),
        false,
        `chainsEffective=false 时 transit_group "${definition.name}" 不应出现`,
      );
    }
  }

  // 计算每个节点名应有的 dialer-proxy 值（首个命中的 chain 胜出）
  const expectedDialerByName = new Map();
  if (chainsEffective) {
    for (const definition of chainDefs) {
      const transitName = transitIdToName.get(definition.entry);
      if (!transitName) {
        continue;
      }
      const pattern = new RegExp(definition.landing_pattern, definition.flags || "");
      for (const proxy of namedProxies) {
        if (pattern.test(proxy.name) && !expectedDialerByName.has(proxy.name)) {
          expectedDialerByName.set(proxy.name, transitName);
        }
      }
    }
  }

  for (const proxy of result.proxies) {
    const expected = expectedDialerByName.get(proxy.name);
    assert.equal(
      proxy["dialer-proxy"],
      expected,
      `节点 "${proxy.name}" 的 dialer-proxy 应为 ${expected ?? "undefined"}，实际为 ${proxy["dialer-proxy"]}`,
    );
  }
}

/**
 * 校验 runtime preset 仅在缺失字段时注入，不覆盖用户已有配置。
 * @returns {void}
 */
function testRuntimeInjectionSemantics() {
  const { main } = loadBundleRuntime();
  const input = {
    proxies: loadTemplateProxies(),
    "allow-lan": false,
    tun: { enable: true, stack: "gvisor" },
  };
  const result = main(input);

  assert.equal(result["allow-lan"], false, "已有 allow-lan 配置应被保留");
  assert.deepEqual(result.tun, { enable: true, stack: "gvisor" }, "已有 tun 配置应被保留");
}

/**
 * 校验代理列表缺失时 bundle 仍保留 runtime preset，并跳过规则生成。
 * @returns {void}
 */
function testNoProxyFallback() {
  const { main, logs } = loadBundleRuntime();
  const result = main({ proxies: [{}] });

  assert.equal(result.dns.enable, true, "即使代理列表无效，也应继续应用 runtime 预设");
  assert.equal(result["proxy-groups"], undefined, "代理列表无效时应跳过 proxy-groups 生成");
  assert.equal(result["rule-providers"], undefined, "代理列表无效时应跳过 rule-providers 生成");
  assert.equal(result.rules, undefined, "代理列表无效时应跳过 rules 生成");
  assert.ok(logs.some((line) => line.includes("跳过 proxy-groups、rule-providers 和 rules 生成")), "降级路径应输出诊断日志");
}

/**
 * 校验 prependRules 中引用不存在策略组时，assembleRuleSet 会拒绝该输入。
 * @returns {void}
 */
function testInvalidInlineRuleTargetRejected() {
  const missingTargetGroup = "__nonexistent_group__";

  assert.throws(
    () =>
      assembleRuleSet(groupDefinitionsConfig.groupDefinitions, ruleProvidersConfig.ruleProviders, {
        prependRules: [`DST-PORT,22,${missingTargetGroup}`],
      }),
    (error) => error instanceof Error && error.message.includes(missingTargetGroup),
    `prependRules 引用未定义策略组时，错误信息应包含目标组名: ${missingTargetGroup}`,
  );
}

/**
 * 校验带 no-resolve 尾缀的合法 prepend 规则会按原样保留在首位。
 * @returns {void}
 */
function testInlineRuleWithNoResolveTargetAccepted() {
  // 从现有策略组中任取一个组名，避免将具体组名硬编码到测试里
  const anyGroupName = Object.values(groupDefinitionsConfig.groupDefinitions)
    .map((definition) => definition?.name)
    .find((name) => typeof name === "string" && name.length > 0);
  assert.ok(anyGroupName, "groupDefinitions 至少应包含一个已命名策略组");

  const prependRule = `IP-CIDR,1.1.1.1/32,${anyGroupName},no-resolve`;
  const { rules } = assembleRuleSet(groupDefinitionsConfig.groupDefinitions, ruleProvidersConfig.ruleProviders, {
    prependRules: [prependRule],
  });

  assert.equal(rules[0], prependRule, "带 no-resolve 尾缀的合法 prepend 规则应原样保留在首位");
}

/**
 * 校验 buildChainGroups：按 first-match-wins 抽出 landing 节点，
 * 返回每个 chain_group 定义对应的组与剔除 landing 后的 remainingProxies。
 * @returns {void}
 */
function testBuildChainGroupsBasic() {
  const namedProxies = [
    { name: "Sample-🇭🇰-Hong Kong-01" },
    { name: "Sample-🇸🇬-Singapore-01" },
    { name: "自建-SG-Relay-01" },
    { name: "Relay-JP-02" },
    { name: "落地-US-03" },
  ];
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建|Relay|落地",
      flags: "i",
      entry: "transit",
      type: "select",
    },
  ];

  const { chainGroups, remainingProxies } = buildChainGroups(namedProxies, chainDefinitions);

  assert.equal(chainGroups.length, 1, "应构建 1 个 chain_group");
  assert.equal(chainGroups[0].name, "🚪 落地", "chain_group.name 应等于 definition.name");
  assert.equal(chainGroups[0].type, "select", "chain_group.type 应等于 definition.type");
  assert.deepEqual(
    chainGroups[0].proxies,
    ["自建-SG-Relay-01", "Relay-JP-02", "落地-US-03"],
    "chain_group.proxies 应保留订阅顺序，仅包含命中 landing_pattern 的节点名",
  );
  assert.deepEqual(
    remainingProxies.map((p) => p.name),
    ["Sample-🇭🇰-Hong Kong-01", "Sample-🇸🇬-Singapore-01"],
    "remainingProxies 应剔除 landing 节点，保留其余节点的原顺序",
  );
}

/**
 * 校验 chainDefinitions 为空数组时，remainingProxies 直接等于入参副本，chainGroups 为空。
 * @returns {void}
 */
function testBuildChainGroupsEmptyDefinitions() {
  const namedProxies = [{ name: "A" }, { name: "B" }];
  const { chainGroups, remainingProxies } = buildChainGroups(namedProxies, []);
  assert.deepEqual(chainGroups, [], "chainGroups 应为空数组");
  assert.deepEqual(
    remainingProxies.map((p) => p.name),
    ["A", "B"],
    "remainingProxies 应保留全部节点",
  );
}

/**
 * 校验 chain_group 未命中任何节点时会被跳过（不返回空成员组）。
 * @returns {void}
 */
function testBuildChainGroupsNoMatch() {
  const namedProxies = [{ name: "Sample-HK-01" }, { name: "Sample-JP-02" }];
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建|Relay|落地",
      flags: "i",
      entry: "transit",
      type: "select",
    },
  ];
  const { chainGroups, remainingProxies } = buildChainGroups(namedProxies, chainDefinitions);
  assert.equal(chainGroups.length, 0, "未命中 landing_pattern 时应跳过该 chain_group");
  assert.equal(remainingProxies.length, 2, "remainingProxies 应包含全部入参节点");
}

/**
 * 校验 id 重复抛错。
 * @returns {void}
 */
function testBuildChainGroupsDuplicateId() {
  assert.throws(
    () =>
      buildChainGroups(
        [{ name: "自建-01" }],
        [
          { id: "dup", name: "A", landing_pattern: "自建", flags: "i", entry: "transit", type: "select" },
          { id: "dup", name: "B", landing_pattern: "自建", flags: "i", entry: "transit", type: "select" },
        ],
      ),
    (error) => error instanceof Error && error.message.includes("dup"),
    "id 重复应抛错且错误信息包含冲突 id",
  );
}

/**
 * 校验 landing_pattern 非法正则时抛错。
 * @returns {void}
 */
function testBuildChainGroupsInvalidRegex() {
  assert.throws(
    () =>
      buildChainGroups(
        [{ name: "自建-01" }],
        [{ id: "c", name: "A", landing_pattern: "[", flags: "", entry: "transit", type: "select" }],
      ),
    (error) => error instanceof Error && error.message.includes("landing_pattern"),
    "非法正则应抛错且错误信息提示 landing_pattern",
  );
}

/**
 * 校验 transit_pattern 为空时成员等于全部 remainingProxies。
 * @returns {void}
 */
function testBuildTransitGroupsEmptyPattern() {
  const remaining = [{ name: "Sample-🇭🇰-Hong Kong-01" }, { name: "Sample-🇯🇵-Japan-01" }];
  const defs = [
    { id: "transit", name: "🔀 中转", transit_pattern: "", flags: "i", type: "select" },
  ];
  const { groups, idToName } = buildTransitGroups(remaining, defs);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "🔀 中转");
  assert.equal(groups[0].type, "select");
  assert.deepEqual(
    groups[0].proxies,
    ["Sample-🇭🇰-Hong Kong-01", "Sample-🇯🇵-Japan-01"],
    "空 transit_pattern 应包含全部 remainingProxies",
  );
  assert.equal(idToName.get("transit"), "🔀 中转", "idToName 应映射 id 到 name");
}

/**
 * 校验 transit_pattern 非空时按正则过滤 remainingProxies。
 * @returns {void}
 */
function testBuildTransitGroupsFiltered() {
  const remaining = [{ name: "Sample-🇭🇰-Hong Kong-01" }, { name: "Sample-🇯🇵-Japan-01" }];
  const defs = [
    { id: "hk", name: "🇭🇰 中转-港", transit_pattern: "Hong\\s*Kong", flags: "i", type: "select" },
  ];
  const { groups } = buildTransitGroups(remaining, defs);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].proxies, ["Sample-🇭🇰-Hong Kong-01"]);
}

/**
 * 校验成员为空的 transit_group 会被跳过（不进入 idToName，不进入 groups）。
 * @returns {void}
 */
function testBuildTransitGroupsEmptyMembersSkipped() {
  const remaining = [{ name: "Sample-🇭🇰-Hong Kong-01" }];
  const defs = [
    { id: "jp", name: "🇯🇵 中转-日", transit_pattern: "Japan", flags: "i", type: "select" },
  ];
  const { groups, idToName } = buildTransitGroups(remaining, defs);
  assert.equal(groups.length, 0, "成员为空的 transit_group 应被跳过");
  assert.equal(idToName.has("jp"), false, "被跳过的 transit 不进入 idToName");
}

/**
 * 校验 transit_group id 重复抛错。
 * @returns {void}
 */
function testBuildTransitGroupsDuplicateId() {
  assert.throws(
    () =>
      buildTransitGroups(
        [{ name: "A" }],
        [
          { id: "t", name: "X", transit_pattern: "", flags: "", type: "select" },
          { id: "t", name: "Y", transit_pattern: "", flags: "", type: "select" },
        ],
      ),
    (error) => error instanceof Error && error.message.includes("transit_group"),
    "transit_group id 重复应抛错",
  );
}

/**
 * 校验 buildTransitGroups:include_direct=true 且 type 非 url-test 时，
 * proxies 末尾追加字符串 "DIRECT";缺省 / false 时不追加。
 * @returns {void}
 */
function testBuildTransitGroupsAppendsDirectForSelect() {
  const remaining = [{ name: "Sample-HK-01" }, { name: "Sample-JP-01" }];

  // include_direct 缺省 → 不追加
  const { groups: groupsMissing } = buildTransitGroups(remaining, [
    { id: "t1", name: "T1", transit_pattern: "", flags: "", type: "select" },
  ]);
  assert.deepEqual(
    groupsMissing[0].proxies,
    ["Sample-HK-01", "Sample-JP-01"],
    "include_direct 缺省时 proxies 不应追加 DIRECT",
  );

  // include_direct: false → 不追加
  const { groups: groupsFalse } = buildTransitGroups(remaining, [
    { id: "t2", name: "T2", transit_pattern: "", flags: "", type: "select", include_direct: false },
  ]);
  assert.deepEqual(
    groupsFalse[0].proxies,
    ["Sample-HK-01", "Sample-JP-01"],
    "include_direct=false 时 proxies 不应追加 DIRECT",
  );

  // include_direct: true + type=select → 末尾追加 DIRECT
  const { groups: groupsTrue } = buildTransitGroups(remaining, [
    { id: "t3", name: "T3", transit_pattern: "", flags: "", type: "select", include_direct: true },
  ]);
  assert.deepEqual(
    groupsTrue[0].proxies,
    ["Sample-HK-01", "Sample-JP-01", "DIRECT"],
    "include_direct=true + type=select 时 proxies 末尾应为 'DIRECT'",
  );
}

/**
 * 校验 buildTransitGroups:include_direct=true 且 type=url-test 时，
 * 不追加 DIRECT 且输出 WARN 日志。
 * @returns {void}
 */
function testBuildTransitGroupsSkipsDirectForUrlTest() {
  const remaining = [{ name: "Sample-HK-01" }, { name: "Sample-JP-01" }];
  const originalLog = console.log;
  const captured = [];
  console.log = (message) => captured.push(String(message));

  try {
    const { groups } = buildTransitGroups(remaining, [
      {
        id: "auto-transit",
        name: "T-URL",
        transit_pattern: "",
        flags: "",
        type: "url-test",
        include_direct: true,
      },
    ]);
    assert.deepEqual(
      groups[0].proxies,
      ["Sample-HK-01", "Sample-JP-01"],
      "type=url-test 时即便 include_direct=true 也不应追加 DIRECT",
    );
  } finally {
    console.log = originalLog;
  }

  assert.ok(
    captured.some(
      (line) =>
        line.includes("WARN") &&
        line.includes("transit_group") &&
        line.includes("auto-transit") &&
        line.includes("url-test") &&
        line.includes("include_direct"),
    ),
    `应输出 WARN 日志，实际捕获: ${JSON.stringify(captured)}`,
  );
}

/**
 * 校验 buildTransitGroups:transit_pattern 过滤后成员为空时，
 * 即便 include_direct=true 也仍然跳过（DIRECT 不挽救空组）。
 * @returns {void}
 */
function testBuildTransitGroupsEmptyMembersSkippedEvenWithIncludeDirect() {
  const remaining = [{ name: "Sample-HK-01" }];
  const { groups, idToName } = buildTransitGroups(remaining, [
    {
      id: "jp",
      name: "🇯🇵 T-JP",
      transit_pattern: "Japan",
      flags: "i",
      type: "select",
      include_direct: true,
    },
  ]);

  assert.equal(groups.length, 0, "空成员 + include_direct=true 仍应跳过");
  assert.equal(idToName.has("jp"), false, "被跳过的 transit 不进入 idToName");
}

/**
 * 校验 applyProxyChains 为命中 landing_pattern 的节点注入 dialer-proxy = transit.name。
 * @returns {void}
 */
function testApplyProxyChainsBasic() {
  const config = {
    proxies: [
      { name: "Sample-🇭🇰-Hong Kong-01" },
      { name: "自建-SG-Relay-01" },
      { name: "Relay-JP-02" },
    ],
  };
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建|Relay|落地",
      flags: "i",
      entry: "transit",
      type: "select",
    },
  ];
  const transitIdToName = new Map([["transit", "🔀 中转"]]);

  applyProxyChains(config, chainDefinitions, transitIdToName);

  assert.equal(config.proxies[0]["dialer-proxy"], undefined, "非 landing 节点不应被注入");
  assert.equal(config.proxies[1]["dialer-proxy"], "🔀 中转", "landing 节点应注入 dialer-proxy");
  assert.equal(config.proxies[2]["dialer-proxy"], "🔀 中转", "landing 节点应注入 dialer-proxy");
}

/**
 * 校验节点已存在 dialer-proxy 时保留原值并 WARN，不覆盖。
 * @returns {void}
 */
function testApplyProxyChainsPreservesExisting() {
  const config = {
    proxies: [
      { name: "自建-SG-Relay-01", "dialer-proxy": "既有前置" },
    ],
  };
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建",
      flags: "i",
      entry: "transit",
      type: "select",
    },
  ];
  const transitIdToName = new Map([["transit", "🔀 中转"]]);

  applyProxyChains(config, chainDefinitions, transitIdToName);

  assert.equal(
    config.proxies[0]["dialer-proxy"],
    "既有前置",
    "已有 dialer-proxy 应被保留",
  );
}

/**
 * 校验 chain.entry 对应的 transit 未被构建（不在 idToName 中）时，该 chain 整体跳过。
 * @returns {void}
 */
function testApplyProxyChainsSkipsMissingTransit() {
  const config = { proxies: [{ name: "自建-01" }] };
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建",
      flags: "i",
      entry: "transit-missing",
      type: "select",
    },
  ];
  const transitIdToName = new Map();

  applyProxyChains(config, chainDefinitions, transitIdToName);

  assert.equal(
    config.proxies[0]["dialer-proxy"],
    undefined,
    "entry 指向未构建的 transit 时不应注入",
  );
}

/**
 * 校验 validateChainsSchema：chain.entry 指向未定义的 transit_group.id 时必须抛错。
 * 与 applyProxyChains 的运行时 WARN 行为（transit 定义过但成员空）区分开。
 * @returns {void}
 */
function testValidateChainsSchemaRejectsUnknownEntry() {
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建",
      flags: "i",
      entry: "transti", // 故意拼写错误
      type: "select",
    },
  ];
  const transitDefinitions = [
    { id: "transit", name: "🔀 中转", transit_pattern: "", flags: "i", type: "select" },
  ];

  assert.throws(
    () => validateChainsSchema(chainDefinitions, transitDefinitions),
    (error) =>
      error instanceof Error &&
      error.message.includes("transti") &&
      error.message.includes("entry"),
    "entry 指向未定义的 transit.id 应抛错，错误信息含冲突 id 与 entry 关键字",
  );
}

/**
 * 校验 validateChainsSchema：合法配置不抛错。
 * @returns {void}
 */
function testValidateChainsSchemaAcceptsValid() {
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建",
      flags: "i",
      entry: "transit",
      type: "select",
    },
  ];
  const transitDefinitions = [
    { id: "transit", name: "🔀 中转", transit_pattern: "", flags: "i", type: "select" },
  ];
  validateChainsSchema(chainDefinitions, transitDefinitions);
  // 无抛错即通过
}

/**
 * 校验 validateChainsSchema：chain_group 或 transit_group 为空数组时视为合法（跳过校验）。
 * @returns {void}
 */
function testValidateChainsSchemaEmptyArraysAccepted() {
  validateChainsSchema([], []);
  validateChainsSchema([], [{ id: "t", name: "X", transit_pattern: "", flags: "", type: "select" }]);
  // 无抛错即通过
}

/**
 * 校验 validateChainsSchema:transit_group.include_direct 若存在必须为布尔。
 * undefined / true / false 通过;null / 字符串 / 数字等一律抛错。
 * @returns {void}
 */
function testValidateChainsSchemaAcceptsBooleanIncludeDirect() {
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建",
      flags: "i",
      entry: "transit",
      type: "select",
    },
  ];

  // include_direct 缺省 → 通过
  validateChainsSchema(chainDefinitions, [
    { id: "transit", name: "🔀 中转", transit_pattern: "", flags: "i", type: "select" },
  ]);

  // include_direct: true → 通过
  validateChainsSchema(chainDefinitions, [
    {
      id: "transit",
      name: "🔀 中转",
      transit_pattern: "",
      flags: "i",
      type: "select",
      include_direct: true,
    },
  ]);

  // include_direct: false → 通过
  validateChainsSchema(chainDefinitions, [
    {
      id: "transit",
      name: "🔀 中转",
      transit_pattern: "",
      flags: "i",
      type: "select",
      include_direct: false,
    },
  ]);
}

/**
 * 校验 validateChainsSchema:transit_group.include_direct 非布尔值(含 null / 字符串 / 数字)应抛错。
 * @returns {void}
 */
function testValidateChainsSchemaRejectsNonBooleanIncludeDirect() {
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建",
      flags: "i",
      entry: "transit",
      type: "select",
    },
  ];

  const invalidValues = [null, "true", "false", 0, 1, {}, []];

  for (const invalid of invalidValues) {
    assert.throws(
      () =>
        validateChainsSchema(chainDefinitions, [
          {
            id: "transit",
            name: "🔀 中转",
            transit_pattern: "",
            flags: "i",
            type: "select",
            include_direct: invalid,
          },
        ]),
      (error) =>
        error instanceof Error &&
        error.message.includes("transit") &&
        error.message.includes("include_direct") &&
        error.message.includes("布尔"),
      `include_direct=${JSON.stringify(invalid)} 应抛错且错误信息含 transit/include_direct/布尔`,
    );
  }
}

/**
 * 校验 buildProxyGroups 的 extras 参数：chain_groups 和 transit_groups
 * 按约定位置（保留组之后、其他自定义组之前）插入。
 * @returns {void}
 */
function testBuildProxyGroupsInsertsChainAndTransit() {
  const namedProxies = [
    { name: "Sample-🇭🇰-Hong Kong-01" },
    { name: "Sample-🇯🇵-Japan-01" },
  ];
  const chainGroupFixture = {
    name: "🚪 落地",
    type: "select",
    proxies: ["自建-SG-Relay-01"],
  };
  const transitGroupFixture = {
    name: "🔀 中转",
    type: "select",
    proxies: ["Sample-🇭🇰-Hong Kong-01", "Sample-🇯🇵-Japan-01"],
  };

  const groupsWithoutExtras = buildProxyGroups(
    namedProxies,
    groupDefinitionsConfig.groupDefinitions,
  );
  const groupsWithExtras = buildProxyGroups(
    namedProxies,
    groupDefinitionsConfig.groupDefinitions,
    { chainGroups: [chainGroupFixture], transitGroups: [transitGroupFixture] },
  );

  assert.equal(
    groupsWithExtras.length,
    groupsWithoutExtras.length + 2,
    "extras 非空时应额外增加 2 个组",
  );

  const names = groupsWithExtras.map((g) => g.name);
  const chainIndex = names.indexOf(chainGroupFixture.name);
  const transitIndex = names.indexOf(transitGroupFixture.name);
  // 从 regionsConfig 动态获取首个区域组的期望名称，避免硬编码 regions.yaml 的具体值
  const firstRegion = regionsConfig[0];
  const firstRegionGroupName = `${firstRegion.icon} ${firstRegion.name}`;
  const regionIndex = names.indexOf(firstRegionGroupName);

  assert.ok(chainIndex > -1, "应包含 chain_group");
  assert.ok(transitIndex > -1, "应包含 transit_group");
  assert.ok(chainIndex < transitIndex, "chain_group 应位于 transit_group 之前");
  if (regionIndex > -1) {
    assert.ok(transitIndex < regionIndex, "transit_group 应位于区域组之前");
  }

  // 保留组应位于 chain_group 之前
  const reservedIds = placeholdersConfig.reserved;
  const fallbackId = placeholdersConfig.fallback;
  for (const id of reservedIds) {
    const def = groupDefinitionsConfig.groupDefinitions[id];
    const idx = names.indexOf(def.name);
    assert.ok(
      idx > -1 && idx < chainIndex,
      `保留组 ${def.name} 应位于 chain_group 之前`,
    );
  }

  // 其他自定义组（非保留、非 fallback）应位于 transit_group 之后
  for (const id of Object.keys(groupDefinitionsConfig.groupDefinitions)) {
    if (reservedIds.includes(id) || id === fallbackId) continue;
    const def = groupDefinitionsConfig.groupDefinitions[id];
    const idx = names.indexOf(def.name);
    assert.ok(
      idx > -1 && idx > transitIndex,
      `自定义组 ${def.name} 应位于 transit_group 之后`,
    );
  }
}

/**
 * 校验未传 extras 或 extras 为空数组时，buildProxyGroups 行为与旧版完全一致。
 * @returns {void}
 */
function testBuildProxyGroupsExtrasOptional() {
  const namedProxies = [{ name: "Sample-🇭🇰-Hong Kong-01" }];
  const groupsA = buildProxyGroups(namedProxies, groupDefinitionsConfig.groupDefinitions);
  const groupsB = buildProxyGroups(
    namedProxies,
    groupDefinitionsConfig.groupDefinitions,
    { chainGroups: [], transitGroups: [] },
  );
  assert.deepEqual(
    normalize(groupsA),
    normalize(groupsB),
    "空 extras 应产生与未传参时相同的结果",
  );
}

/**
 * 校验 @chain-groups 占位符展开为 chain_group 组名列表。
 * 当 extras.chainGroups 非空时，使用了 @chain-groups 的策略组应包含链式代理组名。
 * 当 extras.chainGroups 为空时，@chain-groups 展开为空，不影响 proxies 列表。
 * @returns {void}
 */
function testChainGroupsPlaceholderExpansion() {
  const namedProxies = [
    { name: "Sample-🇭🇰-Hong Kong-01" },
    { name: "Sample-🇯🇵-Japan-01" },
  ];
  const chainGroupFixture = {
    name: "🚪 落地",
    type: "select",
    proxies: ["自建-SG-Relay-01"],
  };

  // 有 chainGroups 时，含 @chain-groups 的组应包含链式代理组名
  const groupsWithChain = buildProxyGroups(
    namedProxies,
    groupDefinitionsConfig.groupDefinitions,
    { chainGroups: [chainGroupFixture], transitGroups: [] },
  );

  // 找到含 @region-groups 的组（即应同时含 @chain-groups 的组）
  // 使用 non_cn 作为代表检查
  const nonCnDef = groupDefinitionsConfig.groupDefinitions.non_cn;
  const nonCnGroup = groupsWithChain.find((g) => g.name === nonCnDef.name);
  assert.ok(nonCnGroup, "non_cn 组应存在");
  assert.ok(
    nonCnGroup.proxies.includes(chainGroupFixture.name),
    "含 @chain-groups 的组应包含链式代理组名",
  );

  // chainGroups 为空时，组中不应出现链式代理组名
  const groupsWithoutChain = buildProxyGroups(
    namedProxies,
    groupDefinitionsConfig.groupDefinitions,
    { chainGroups: [], transitGroups: [] },
  );
  const nonCnGroupNoChain = groupsWithoutChain.find((g) => g.name === nonCnDef.name);
  assert.ok(nonCnGroupNoChain, "non_cn 组应存在");
  assert.ok(
    !nonCnGroupNoChain.proxies.includes(chainGroupFixture.name),
    "chainGroups 为空时不应出现链式代理组名",
  );
}

/**
 * 校验 remainingProxies 传入 buildProxyGroups 后，落地节点不出现在
 * @all-nodes 和 @region-groups 展开的组中。
 * @returns {void}
 */
function testRemainingProxiesExcludesLanding() {
  const allProxies = [
    { name: "Sample-🇭🇰-Hong Kong-01" },
    { name: "Sample-🇯🇵-Japan-01" },
    { name: "自建-SG-Relay-01" },
    { name: "Relay-US-02" },
  ];
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建|Relay|落地",
      flags: "i",
      entry: "transit",
      type: "select",
    },
  ];

  const { chainGroups, remainingProxies } = buildChainGroups(allProxies, chainDefinitions);

  const groups = buildProxyGroups(
    remainingProxies,
    groupDefinitionsConfig.groupDefinitions,
    { chainGroups, transitGroups: [] },
  );

  // 手动选择组使用 @all-nodes，不应包含落地节点
  const manualDef = groupDefinitionsConfig.groupDefinitions.manual_select;
  const manualGroup = groups.find((g) => g.name === manualDef.name);
  assert.ok(manualGroup, "manual_select 组应存在");
  assert.ok(
    !manualGroup.proxies.includes("自建-SG-Relay-01"),
    "@all-nodes 展开后不应包含落地节点",
  );
  assert.ok(
    !manualGroup.proxies.includes("Relay-US-02"),
    "@all-nodes 展开后不应包含落地节点",
  );
  assert.ok(
    manualGroup.proxies.includes("Sample-🇭🇰-Hong Kong-01"),
    "@all-nodes 应包含非落地节点",
  );
}

/**
 * 端到端（source 层）：手工组合 pipeline 函数，验证非空 chains 配置下
 * chain_group / transit_group / dialer-proxy 均按预期产生。
 * @returns {void}
 */
function testChainPipelineIntegration() {
  const config = {
    proxies: [
      { name: "Sample-🇭🇰-Hong Kong-01" },
      { name: "Sample-🇯🇵-Japan-01" },
      { name: "自建-SG-Relay-01" },
      { name: "Relay-US-02" },
    ],
  };
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建|Relay|落地",
      flags: "i",
      entry: "transit",
      type: "select",
    },
  ];
  const transitDefinitions = [
    { id: "transit", name: "🔀 中转", transit_pattern: "", flags: "i", type: "select" },
  ];

  applyRuntimePreset(config);

  const namedProxies = config.proxies.filter(
    (p) => typeof p.name === "string" && p.name.trim().length > 0,
  );
  const { chainGroups, remainingProxies } = buildChainGroups(namedProxies, chainDefinitions);
  const { groups: transitGroups, idToName: transitIdToName } = buildTransitGroups(
    remainingProxies,
    transitDefinitions,
  );

  config["proxy-groups"] = buildProxyGroups(
    remainingProxies,
    groupDefinitionsConfig.groupDefinitions,
    { chainGroups, transitGroups },
  );

  applyProxyChains(config, chainDefinitions, transitIdToName);

  // dialer-proxy 注入
  const byName = new Map(config.proxies.map((p) => [p.name, p]));
  assert.equal(byName.get("自建-SG-Relay-01")["dialer-proxy"], "🔀 中转");
  assert.equal(byName.get("Relay-US-02")["dialer-proxy"], "🔀 中转");
  assert.equal(byName.get("Sample-🇭🇰-Hong Kong-01")["dialer-proxy"], undefined);

  // transit_group 不含 landing 节点
  const transit = config["proxy-groups"].find((g) => g.name === "🔀 中转");
  assert.ok(transit, "应存在 transit_group");
  for (const memberName of transit.proxies) {
    assert.ok(
      !["自建-SG-Relay-01", "Relay-US-02"].includes(memberName),
      "transit_group 不得包含 landing 节点",
    );
  }

  // chain_group 仅含 landing 节点
  const chain = config["proxy-groups"].find((g) => g.name === "🚪 落地");
  assert.ok(chain, "应存在 chain_group");
  assert.deepEqual(chain.proxies, ["自建-SG-Relay-01", "Relay-US-02"]);
}

/**
 * 校验：存在 dialer-proxy 的节点必须指向某个 proxy-group.name，否则抛错。
 * @returns {void}
 */
function testValidateOutputRejectsDanglingDialerProxy() {
  // 构造一份最小可校验的配置
  const config = {
    proxies: [
      { name: "A" },
      { name: "B", "dialer-proxy": "不存在的组" },
    ],
    "proxy-groups": [
      {
        name: groupDefinitionsConfig.groupDefinitions.proxy_select.name,
        type: "select",
        proxies: ["A"],
      },
      {
        name: groupDefinitionsConfig.groupDefinitions[placeholdersConfig.fallback].name,
        type: "select",
        proxies: ["A"],
      },
    ],
    rules: [`MATCH,${groupDefinitionsConfig.groupDefinitions[placeholdersConfig.fallback].name}`],
  };
  // 为满足 validateOutput 的"策略组完整"检查，补齐其他已配置组
  for (const [id, def] of Object.entries(groupDefinitionsConfig.groupDefinitions)) {
    if (id === "proxy_select" || id === placeholdersConfig.fallback) continue;
    config["proxy-groups"].push({ name: def.name, type: "select", proxies: ["A"] });
  }

  assert.throws(
    () => validateOutput(config, groupDefinitionsConfig.groupDefinitions),
    (error) => error instanceof Error && error.message.includes("dialer-proxy"),
    "dialer-proxy 指向不存在的组时应抛错，错误信息包含 dialer-proxy",
  );
}

/**
 * 校验 §7.2：transit_group 的成员若命中任意 chain_group.landing_pattern，validateOutput 应抛错。
 * 用于在未来重构破坏 "landing 节点必须已从 remainingProxies 剔除" 不变量时立即失败。
 * @returns {void}
 */
function testValidateOutputRejectsTransitContainingLanding() {
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建",
      flags: "i",
      entry: "transit",
      type: "select",
    },
  ];
  const transitDefinitions = [
    { id: "transit", name: "🔀 中转", transit_pattern: "", flags: "i", type: "select" },
  ];

  const config = {
    proxies: [{ name: "自建-01" }, { name: "Sample-HK-01" }],
    "proxy-groups": [
      // transit_group 错误地包含了 landing 节点 "自建-01"
      { name: "🔀 中转", type: "select", proxies: ["自建-01", "Sample-HK-01"] },
      { name: "🚪 落地", type: "select", proxies: ["自建-01"] },
    ],
    rules: [`MATCH,${groupDefinitionsConfig.groupDefinitions[placeholdersConfig.fallback].name}`],
  };
  for (const def of Object.values(groupDefinitionsConfig.groupDefinitions)) {
    config["proxy-groups"].push({ name: def.name, type: "select", proxies: ["Sample-HK-01"] });
  }

  assert.throws(
    () =>
      validateOutput(config, groupDefinitionsConfig.groupDefinitions, {
        chainDefinitions,
        transitDefinitions,
      }),
    (error) =>
      error instanceof Error &&
      error.message.includes("transit_group") &&
      error.message.includes("landing"),
    "transit_group 含 landing 节点应抛错，错误信息应提示 transit_group 与 landing",
  );
}

/**
 * 校验 §7.3：chain_group.proxies 为空时 validateOutput 应抛错。
 * @returns {void}
 */
function testValidateOutputRejectsEmptyChainGroup() {
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "自建",
      flags: "i",
      entry: "transit",
      type: "select",
    },
  ];
  const transitDefinitions = [
    { id: "transit", name: "🔀 中转", transit_pattern: "", flags: "i", type: "select" },
  ];

  const config = {
    proxies: [{ name: "Sample-HK-01" }],
    "proxy-groups": [
      { name: "🚪 落地", type: "select", proxies: [] }, // 空 chain_group
      { name: "🔀 中转", type: "select", proxies: ["Sample-HK-01"] },
    ],
    rules: [`MATCH,${groupDefinitionsConfig.groupDefinitions[placeholdersConfig.fallback].name}`],
  };
  for (const def of Object.values(groupDefinitionsConfig.groupDefinitions)) {
    config["proxy-groups"].push({ name: def.name, type: "select", proxies: ["Sample-HK-01"] });
  }

  assert.throws(
    () =>
      validateOutput(config, groupDefinitionsConfig.groupDefinitions, {
        chainDefinitions,
        transitDefinitions,
      }),
    (error) => error instanceof Error && error.message.includes("chain_group"),
    "空 chain_group 应抛错，错误信息应提示 chain_group",
  );
}

/**
 * 校验 §7.2 的 DIRECT 字面量豁免:transit_group.proxies 含 “DIRECT” 时，
 * 即使 landing_pattern 会命中 “DIRECT” 字符串，也不应抛错。
 * DIRECT 是 Mihomo 内置出口关键字，非订阅节点名，应被短路豁免。
 * @returns {void}
 */
function testValidateOutputAllowsDirectLiteralInTransit() {
  const chainDefinitions = [
    {
      id: "chain",
      name: "🚪 落地",
      landing_pattern: "^DIRECT$", // 精准命中 DIRECT 字面量,用于验证短路豁免
      flags: "",
      entry: "transit",
      type: "select",
    },
  ];
  const transitDefinitions = [
    { id: "transit", name: "🔀 中转", transit_pattern: "", flags: "i", type: "select" },
  ];

  const config = {
    proxies: [{ name: "Sample-HK-01" }, { name: "自建-01" }],
    "proxy-groups": [
      // transit_group.proxies 含 DIRECT 字面量
      { name: "🔀 中转", type: "select", proxies: ["Sample-HK-01", "DIRECT"] },
      { name: "🚪 落地", type: "select", proxies: ["自建-01"] },
    ],
    rules: [`MATCH,${groupDefinitionsConfig.groupDefinitions[placeholdersConfig.fallback].name}`],
  };
  for (const def of Object.values(groupDefinitionsConfig.groupDefinitions)) {
    config["proxy-groups"].push({ name: def.name, type: "select", proxies: ["Sample-HK-01"] });
  }

  // 不应抛错:DIRECT 字面量应被 §7.2 短路豁免
  validateOutput(config, groupDefinitionsConfig.groupDefinitions, {
    chainDefinitions,
    transitDefinitions,
  });
}

/**
 * 校验 placeholders.yaml 缺少必填 placeholders 字段时，buildYamlModules 应在构建阶段失败。
 * @returns {Promise<void>}
 */
async function testBuildYamlModulesRejectsMissingPlaceholdersField() {
  await withTempDefinitionsWorkspace(async (workspaceRoot) => {
    const placeholdersPath = path.join(
      workspaceRoot,
      "definitions",
      "proxy-groups",
      "placeholders.yaml",
    );

    await transformTextFile(placeholdersPath, (sourceText) =>
      sourceText.replace(/^placeholders:/m, "mappings:"),
    );

    await assert.rejects(
      buildYamlModules({
        cwd: workspaceRoot,
        requiredNamespaces: ["proxy-groups"],
        log: () => {},
      }),
      (error) =>
        error instanceof Error && error.message.includes("placeholders 必须是对象"),
      "缺少 placeholders 字段时应在构建阶段报错",
    );
  });
}

/**
 * 校验 placeholders.yaml 的 fallback 若引用未定义策略组，buildYamlModules 应失败。
 * @returns {Promise<void>}
 */
async function testBuildYamlModulesRejectsUnknownFallbackGroup() {
  await withTempDefinitionsWorkspace(async (workspaceRoot) => {
    const placeholdersPath = path.join(
      workspaceRoot,
      "definitions",
      "proxy-groups",
      "placeholders.yaml",
    );

    await transformTextFile(placeholdersPath, (sourceText) =>
      sourceText.replace(/^fallback:\s+\S+$/m, "fallback: missing_fallback"),
    );

    await assert.rejects(
      buildYamlModules({
        cwd: workspaceRoot,
        requiredNamespaces: ["proxy-groups"],
        log: () => {},
      }),
      (error) =>
        error instanceof Error && error.message.includes("fallback 引用了未定义的策略组"),
      "fallback 引用未定义策略组时应在构建阶段报错",
    );
  });
}

/**
 * 校验 placeholders.yaml 的 kind=ref 占位符若引用未定义策略组，buildYamlModules 应失败。
 * @returns {Promise<void>}
 */
async function testBuildYamlModulesRejectsUnknownPlaceholderRefTarget() {
  await withTempDefinitionsWorkspace(async (workspaceRoot) => {
    const placeholdersPath = path.join(
      workspaceRoot,
      "definitions",
      "proxy-groups",
      "placeholders.yaml",
    );

    await transformTextFile(placeholdersPath, (sourceText) =>
      sourceText.replace("target: proxy_select", "target: missing_target"),
    );

    await assert.rejects(
      buildYamlModules({
        cwd: workspaceRoot,
        requiredNamespaces: ["proxy-groups"],
        log: () => {},
      }),
      (error) =>
        error instanceof Error && error.message.includes("引用了未定义的策略组: missing_target"),
      "kind=ref 占位符引用未定义策略组时应在构建阶段报错",
    );
  });
}

/**
 * 校验仅编译指定命名空间时，不得误删其他命名空间产物；但历史 runtime 目录仍应被清理。
 * @returns {Promise<void>}
 */
async function testBuildYamlModulesPartialCompilePreservesOtherNamespaces() {
  await withTempDefinitionsWorkspace(async (workspaceRoot) => {
    const preservedFile = path.join(
      workspaceRoot,
      "scripts",
      "config",
      "mihomo-preset",
      "sentinel.js",
    );
    const legacyRuntimeFile = path.join(
      workspaceRoot,
      "scripts",
      "config",
      "runtime",
      "legacy.js",
    );

    await fsPromises.mkdir(path.dirname(preservedFile), { recursive: true });
    await fsPromises.writeFile(preservedFile, "export default 1;\n", "utf8");
    await fsPromises.mkdir(path.dirname(legacyRuntimeFile), { recursive: true });
    await fsPromises.writeFile(legacyRuntimeFile, "export default 1;\n", "utf8");

    await buildYamlModules({
      cwd: workspaceRoot,
      requiredNamespaces: ["rules"],
      log: () => {},
    });

    await fsPromises.access(preservedFile);
    await assert.rejects(
      fsPromises.access(legacyRuntimeFile),
      (error) => error instanceof Error && "code" in error && error.code === "ENOENT",
      "历史 runtime 目录应在部分编译时被清理",
    );
    assert.ok(
      fs.existsSync(path.join(workspaceRoot, "scripts", "config", "rules", "inlineRules.js")),
      "仅编译 rules 时仍应生成 rules 命名空间产物",
    );
  });
}

/**
 * 校验示例配置序列化结果仍包含关键产物分段。
 * @returns {void}
 */
function testExampleConfigSerialization() {
  const { main } = loadBundleRuntime();
  const result = main({ proxies: loadTemplateProxies() });
  const yamlText = stringifyExampleConfig(result);

  assert.ok(yamlText.includes("proxy-groups:"), "示例配置 YAML 应包含 proxy-groups");
  assert.ok(yamlText.includes("rule-providers:"), "示例配置 YAML 应包含 rule-providers");
  assert.ok(yamlText.includes("rules:"), "示例配置 YAML 应包含 rules");
}

/**
 * 执行主 bundle 的完整校验流程。
 * @returns {Promise<void>}
 */
async function main() {
  testBuildChainGroupsBasic();
  testBuildChainGroupsEmptyDefinitions();
  testBuildChainGroupsNoMatch();
  testBuildChainGroupsDuplicateId();
  testBuildChainGroupsInvalidRegex();
  testBuildTransitGroupsEmptyPattern();
  testBuildTransitGroupsFiltered();
  testBuildTransitGroupsEmptyMembersSkipped();
  testBuildTransitGroupsDuplicateId();
  testBuildTransitGroupsAppendsDirectForSelect();
  testBuildTransitGroupsSkipsDirectForUrlTest();
  testBuildTransitGroupsEmptyMembersSkippedEvenWithIncludeDirect();
  testApplyProxyChainsBasic();
  testApplyProxyChainsPreservesExisting();
  testApplyProxyChainsSkipsMissingTransit();
  testValidateChainsSchemaRejectsUnknownEntry();
  testValidateChainsSchemaAcceptsValid();
  testValidateChainsSchemaEmptyArraysAccepted();
  testValidateChainsSchemaAcceptsBooleanIncludeDirect();
  testValidateChainsSchemaRejectsNonBooleanIncludeDirect();
  testBuildProxyGroupsInsertsChainAndTransit();
  testBuildProxyGroupsExtrasOptional();
  testChainGroupsPlaceholderExpansion();
  testRemainingProxiesExcludesLanding();
  testChainPipelineIntegration();
  testValidateOutputRejectsDanglingDialerProxy();
  testValidateOutputRejectsTransitContainingLanding();
  testValidateOutputRejectsEmptyChainGroup();
  testValidateOutputAllowsDirectLiteralInTransit();
  await testBuildYamlModulesRejectsMissingPlaceholdersField();
  await testBuildYamlModulesRejectsUnknownFallbackGroup();
  await testBuildYamlModulesRejectsUnknownPlaceholderRefTarget();
  await testBuildYamlModulesPartialCompilePreservesOtherNamespaces();
  assertGeneratedFiles();
  assertCustomAssetCopy();
  testBundlePositivePath();
  testBundleChainsEndToEnd();
  testRuntimeInjectionSemantics();
  testNoProxyFallback();
  testInvalidInlineRuleTargetRejected();
  testInlineRuleWithNoResolveTargetAccepted();
  testExampleConfigSerialization();
  console.log("主 bundle 验证通过");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

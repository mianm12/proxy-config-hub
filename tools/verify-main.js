import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import baseConfig from "../scripts/config/runtime/base.js";
import dnsConfig from "../scripts/config/runtime/dns.js";
import geodataConfig from "../scripts/config/runtime/geodata.js";
import profileConfig from "../scripts/config/runtime/profile.js";
import groupDefinitionsConfig from "../scripts/config/rules/groupDefinitions.js";
import inlineRulesConfig from "../scripts/config/rules/inlineRules.js";
import ruleProvidersConfig from "../scripts/config/rules/ruleProviders.js";
import snifferConfig from "../scripts/config/runtime/sniffer.js";
import tunConfig from "../scripts/config/runtime/tun.js";
import { assembleRuleSet } from "../scripts/override/lib/rule-assembly.js";
import { applyProxyChains, buildChainGroups, buildTransitGroups } from "../scripts/override/lib/proxy-chains.js";
import { buildProxyGroups } from "../scripts/override/lib/proxy-groups.js";
import {
  loadBundleRuntime,
  loadTemplateProxies,
  stringifyExampleConfig,
} from "./lib/bundle-runtime.js";
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
  const fallbackGroupName = groupDefinitions?.fallback?.name;

  assert.ok(
    typeof fallbackGroupName === "string" && fallbackGroupName.length > 0,
    "groupDefinitions.fallback.name 必须已定义",
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
    !fs.existsSync(path.join(SCRIPTS_CONFIG_DIR, "rules", "custom", "_template.js")),
    "custom 模板不得被转换到 scripts/config",
  );
}

/**
 * 校验 definitions/rules/custom 资源是否被无损复制到 dist。
 * @returns {void}
 */
function assertCustomAssetCopy() {
  const sourcePath = path.join(REPO_ROOT, "definitions", "rules", "custom", "_template.yaml");
  const distPath = path.join(REPO_ROOT, "dist", "rules", "custom", "_template.yaml");
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
  assert.equal(result.rules.at(-1), fallbackRule, "最后一条规则应为 groupDefinitions.fallback 对应的 MATCH");
  assert.ok(!bundleCode.includes("definitions/rules/registry"), "bundle 不得引用 definitions/rules/registry 路径");
  assert.ok(!bundleCode.includes("definitions/runtime"), "bundle 不得引用 definitions/runtime 路径");
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
 * 校验 buildProxyGroups 的 extras 参数：chain_groups 和 transit_groups
 * 按约定位置（自定义组之后、区域组之前）插入。
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
  const chainIndex = names.indexOf("🚪 落地");
  const transitIndex = names.indexOf("🔀 中转");
  const hkIndex = names.indexOf("🇭🇰 香港");

  assert.ok(chainIndex > -1, "应包含 chain_group");
  assert.ok(transitIndex > -1, "应包含 transit_group");
  assert.ok(chainIndex < transitIndex, "chain_group 应位于 transit_group 之前");
  if (hkIndex > -1) {
    assert.ok(transitIndex < hkIndex, "transit_group 应位于区域组之前");
  }

  // 自定义组与保留组都应位于 chain_group 之前
  const chainGroupIds = Object.keys(groupDefinitionsConfig.groupDefinitions);
  for (const id of chainGroupIds) {
    const def = groupDefinitionsConfig.groupDefinitions[id];
    if (id === "fallback") continue;
    const idx = names.indexOf(def.name);
    assert.ok(
      idx > -1 && idx < chainIndex,
      `已配置策略组 ${def.name} 应位于 chain_group 之前`,
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
 * @returns {void}
 */
function main() {
  testBuildChainGroupsBasic();
  testBuildChainGroupsEmptyDefinitions();
  testBuildChainGroupsNoMatch();
  testBuildChainGroupsDuplicateId();
  testBuildChainGroupsInvalidRegex();
  testBuildTransitGroupsEmptyPattern();
  testBuildTransitGroupsFiltered();
  testBuildTransitGroupsEmptyMembersSkipped();
  testBuildTransitGroupsDuplicateId();
  testApplyProxyChainsBasic();
  testApplyProxyChainsPreservesExisting();
  testApplyProxyChainsSkipsMissingTransit();
  testBuildProxyGroupsInsertsChainAndTransit();
  testBuildProxyGroupsExtrasOptional();
  assertGeneratedFiles();
  assertCustomAssetCopy();
  testBundlePositivePath();
  testRuntimeInjectionSemantics();
  testNoProxyFallback();
  testInvalidInlineRuleTargetRejected();
  testInlineRuleWithNoResolveTargetAccepted();
  testExampleConfigSerialization();
  console.log("主 bundle 验证通过");
}

main();

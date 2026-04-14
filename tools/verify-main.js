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
import {
  REPO_ROOT,
  loadBundleRuntime,
  loadTemplateProxies,
  stringifyExampleConfig,
} from "./lib/bundle-runtime.js";

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
 * @returns {void}
 */
function assertGeneratedFiles() {
  const requiredFiles = [
    path.join(REPO_ROOT, "scripts", "config", "rules", "groupDefinitions.js"),
    path.join(REPO_ROOT, "scripts", "config", "rules", "inlineRules.js"),
    path.join(REPO_ROOT, "scripts", "config", "rules", "ruleProviders.js"),
    path.join(REPO_ROOT, "scripts", "config", "runtime", "base.js"),
    path.join(REPO_ROOT, "scripts", "config", "runtime", "dns.js"),
    path.join(REPO_ROOT, "scripts", "config", "runtime", "profile.js"),
    path.join(REPO_ROOT, "scripts", "config", "runtime", "geodata.js"),
    path.join(REPO_ROOT, "scripts", "config", "runtime", "sniffer.js"),
    path.join(REPO_ROOT, "scripts", "config", "runtime", "tun.js"),
  ];

  for (const filePath of requiredFiles) {
    assert.ok(fs.existsSync(filePath), `缺少生成产物文件: ${path.relative(REPO_ROOT, filePath)}`);
  }

  assert.ok(
    !fs.existsSync(path.join(REPO_ROOT, "scripts", "config", "rules", "custom", "_template.js")),
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

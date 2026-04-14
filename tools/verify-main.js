import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  BUNDLE_PATH,
  REPO_ROOT,
  loadBundleRuntime,
  loadTemplateProxies,
  stringifyExampleConfig,
} from "./lib/bundle-runtime.js";

const IP_RULE_PROVIDER_IDS = [
  "private-ip",
  "telegram-ip",
  "twitter-ip",
  "facebook-ip",
  "netflix-ip",
  "google-ip",
  "cloudflare-ip",
  "cn-ip",
];

function normalize(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertSectionApplied(result, expectedSection, label) {
  for (const [key, value] of Object.entries(expectedSection)) {
    assert.deepEqual(
      normalize(result[key]),
      normalize(value),
      `${label} should apply current generated value for ${key}`,
    );
  }
}

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
    assert.ok(fs.existsSync(filePath), `Missing generated file: ${path.relative(REPO_ROOT, filePath)}`);
  }

  assert.ok(
    !fs.existsSync(path.join(REPO_ROOT, "scripts", "config", "rules", "custom", "_template.js")),
    "Custom templates must not be converted into scripts/config",
  );
}

function assertCustomAssetCopy() {
  const sourcePath = path.join(REPO_ROOT, "definitions", "rules", "custom", "_template.yaml");
  const distPath = path.join(REPO_ROOT, "dist", "rules", "custom", "_template.yaml");
  assert.equal(
    fs.readFileSync(distPath, "utf8"),
    fs.readFileSync(sourcePath, "utf8"),
    "Custom template asset should be copied to dist unchanged",
  );
}

function testBundlePositivePath() {
  const { main, bundleCode } = loadBundleRuntime();
  assert.equal(typeof main, "function", "bundle should expose main()");
  const result = main({ proxies: loadTemplateProxies() });

  assertSectionApplied(result, baseConfig, "base runtime config");
  assertSectionApplied(result, profileConfig, "profile runtime config");
  assertSectionApplied(result, geodataConfig, "geodata runtime config");
  assert.deepEqual(normalize(result.dns), normalize(dnsConfig), "dns preset should match generated runtime config");
  assert.deepEqual(normalize(result.sniffer), normalize(snifferConfig), "sniffer preset should match generated runtime config");
  assert.deepEqual(normalize(result.tun), normalize(tunConfig), "tun preset should match generated runtime config");
  assert.ok(Array.isArray(result["proxy-groups"]) && result["proxy-groups"].length > 0, "proxy groups should be generated");
  assert.ok(result["rule-providers"]?.youtube, "rule providers should be generated");
  assert.ok(!("target-group" in result["rule-providers"].youtube), "rule-provider metadata should be stripped");

  const expectedPrependRules = inlineRulesConfig.prependRules ?? [];
  assert.deepEqual(
    normalize(result.rules.slice(0, expectedPrependRules.length)),
    normalize(expectedPrependRules),
    "rules should start with inlineRules.prependRules in declared order",
  );

  for (const providerId of IP_RULE_PROVIDER_IDS) {
    assert.ok(result["rule-providers"]?.[providerId], `missing generated rule provider: ${providerId}`);
    assert.ok(!("target-group" in result["rule-providers"][providerId]), `rule provider should strip target-group metadata: ${providerId}`);
    assert.ok(!("no-resolve" in result["rule-providers"][providerId]), `rule provider should strip no-resolve metadata: ${providerId}`);
    assert.ok(
      result.rules.some((rule) => rule.startsWith(`RULE-SET,${providerId},`) && rule.endsWith(",no-resolve")),
      `ipcidr rule should be emitted with no-resolve: ${providerId}`,
    );
  }

  assert.equal(result.rules.at(-1), "MATCH,🐟 漏网之鱼", "fallback rule should be appended");
  assert.ok(!bundleCode.includes("definitions/rules/registry"), "bundle must not reference canonical YAML paths");
  assert.ok(!bundleCode.includes("definitions/runtime"), "bundle must not reference runtime YAML paths");
}

function testRuntimeInjectionSemantics() {
  const { main } = loadBundleRuntime();
  const input = {
    proxies: loadTemplateProxies(),
    "allow-lan": false,
    tun: { enable: true, stack: "gvisor" },
  };
  const result = main(input);

  assert.equal(result["allow-lan"], false, "existing allow-lan should be preserved");
  assert.deepEqual(result.tun, { enable: true, stack: "gvisor" }, "existing tun config should be preserved");
}

function testNoProxyFallback() {
  const { main, logs } = loadBundleRuntime();
  const result = main({ proxies: [{}] });

  assert.equal(result.dns.enable, true, "runtime preset should still apply on empty proxies");
  assert.equal(result["proxy-groups"], undefined, "proxy groups should be skipped for invalid proxies");
  assert.equal(result["rule-providers"], undefined, "rule providers should be skipped for invalid proxies");
  assert.equal(result.rules, undefined, "rules should be skipped for invalid proxies");
  assert.ok(logs.some((line) => line.includes("跳过 proxy-groups、rule-providers 和 rules 生成")), "fallback path should emit diagnostics");
}

function testInvalidInlineRuleTargetRejected() {
  assert.throws(
    () =>
      assembleRuleSet(groupDefinitionsConfig.groupDefinitions, ruleProvidersConfig.ruleProviders, {
        prependRules: ["DST-PORT,22,__nonexistent_group__"],
      }),
    /Prepend rule references unknown target/,
    "prepend rule target should be validated against configured groups",
  );
}

function testInlineRuleWithNoResolveTargetAccepted() {
  // 从现有策略组中任取一个组名，避免将具体组名硬编码到测试里
  const anyGroupName = Object.values(groupDefinitionsConfig.groupDefinitions)
    .map((definition) => definition?.name)
    .find((name) => typeof name === "string" && name.length > 0);
  assert.ok(anyGroupName, "groupDefinitions 至少应包含一个具名策略组");

  const prependRule = `IP-CIDR,1.1.1.1/32,${anyGroupName},no-resolve`;
  const { rules } = assembleRuleSet(groupDefinitionsConfig.groupDefinitions, ruleProvidersConfig.ruleProviders, {
    prependRules: [prependRule],
  });

  assert.equal(rules[0], prependRule, "带 no-resolve 尾缀的合法 prepend 规则应被保留在首位");
}

function testExampleConfigSerialization() {
  const { main } = loadBundleRuntime();
  const result = main({ proxies: loadTemplateProxies() });
  const yamlText = stringifyExampleConfig(result);

  assert.ok(yamlText.includes("proxy-groups:"), "example config YAML should contain proxy-groups");
  assert.ok(yamlText.includes("rule-providers:"), "example config YAML should contain rule-providers");
  assert.ok(yamlText.includes("rules:"), "example config YAML should contain rules");
}

function main() {
  assertGeneratedFiles();
  assertCustomAssetCopy();
  testBundlePositivePath();
  testRuntimeInjectionSemantics();
  testNoProxyFallback();
  testInvalidInlineRuleTargetRejected();
  testInlineRuleWithNoResolveTargetAccepted();
  testExampleConfigSerialization();
  console.log("Main bundle verification passed");
}

main();

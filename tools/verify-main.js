import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const EXPECTED_DEFAULT_NAMESERVERS = [
  "180.76.76.76",
  "182.254.118.118",
  "119.29.29.29",
  "223.5.5.5",
];

const EXPECTED_NAMESERVERS = [
  "180.76.76.76",
  "119.29.29.29",
  "180.184.1.1",
  "223.5.5.5",
  "https://223.6.6.6/dns-query#h3=true",
  "https://dns.alidns.com/dns-query",
  "https://doh.pub/dns-query",
];

const EXPECTED_FALLBACK_NAMESERVERS = [
  "https://000000.dns.nextdns.io/dns-query#h3=true",
  "https://public.dns.iij.jp/dns-query",
  "https://101.101.101.101/dns-query",
  "https://208.67.220.220/dns-query",
  "tls://8.8.4.4",
  "tls://1.0.0.1:853",
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/dns-query",
];

function assertGeneratedFiles() {
  const requiredFiles = [
    path.join(REPO_ROOT, "scripts", "config", "rules", "groupDefinitions.js"),
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
  const defaultNameservers = Array.from(result.dns["default-nameserver"]);
  const nameservers = Array.from(result.dns.nameserver);
  const fallbackNameservers = Array.from(result.dns.fallback);

  assert.equal(result["mixed-port"], 7897, "runtime base config should be applied");
  assert.equal(result.profile["store-selected"], true, "runtime profile config should be applied");
  assert.equal(result["geodata-mode"], true, "runtime geodata config should be applied");
  assert.equal(result.dns.enable, true, "dns preset should be applied");
  assert.ok(Array.isArray(result["proxy-groups"]) && result["proxy-groups"].length > 0, "proxy groups should be generated");
  assert.ok(result["rule-providers"]?.youtube, "rule providers should be generated");
  assert.ok(!("target-group" in result["rule-providers"].youtube), "rule-provider metadata should be stripped");
  assert.deepEqual(defaultNameservers, EXPECTED_DEFAULT_NAMESERVERS, "default nameservers should use stable domestic bootstrap resolvers");
  assert.deepEqual(nameservers, EXPECTED_NAMESERVERS, "nameserver should only contain domestic resolvers");
  assert.deepEqual(fallbackNameservers, EXPECTED_FALLBACK_NAMESERVERS, "fallback should only contain foreign resolvers");
  assert.equal(result.dns["fallback-filter"]["geoip-code"], "CN", "fallback filter should explicitly target CN");
  assert.ok(!defaultNameservers.includes("180.184.2.2"), "default nameserver should exclude unstable bootstrap resolver");
  assert.ok(!nameservers.includes("8.8.8.8"), "nameserver should exclude foreign plain DNS");
  assert.ok(!nameservers.includes("https://cloudflare-dns.com/dns-query"), "nameserver should exclude foreign DoH");
  assert.ok(!fallbackNameservers.includes("https://dns.alidns.com/dns-query"), "fallback should exclude domestic DoH");
  assert.ok(!fallbackNameservers.includes("https://doh.pub/dns-query"), "fallback should exclude domestic DoH");

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
  testExampleConfigSerialization();
  console.log("Main bundle verification passed");
}

main();

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { stringifyYaml } = require("./yaml-lite");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_EXAMPLE_OUTPUT_PATH = path.join(REPO_ROOT, "dist", "example-full-config.yaml");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function loadBundle(relativePath) {
  return require(path.resolve(REPO_ROOT, "dist", relativePath));
}

function withCapturedConsoleLogs(run) {
  const originalConsoleLog = console.log;
  const capturedLogs = [];

  console.log = (...args) => {
    capturedLogs.push(args.map((value) => String(value)).join(" "));
  };

  try {
    return run(capturedLogs);
  } finally {
    console.log = originalConsoleLog;
  }
}

function assertBundlePurity(relativePath) {
  const filePath = path.join(REPO_ROOT, "dist", relativePath);
  const bundledCode = fs.readFileSync(filePath, "utf8");

  assert(!/\brequire\s*\(/.test(bundledCode), `${relativePath} should not contain require() calls`);
  assert(!/__SOURCES_DATA__/.test(bundledCode), `${relativePath} should not contain unresolved sources placeholder`);
  assert(!/@bundle-inline/.test(bundledCode), `${relativePath} should not contain legacy bundle-inline markers`);
  assert(!/\.\.\/_lib\//.test(bundledCode), `${relativePath} should not reference _lib paths at runtime`);
}

function createSampleConfig() {
  return {
    proxies: [
      {
        name: "Sample-🇭🇰-Hong Kong-01",
        type: "hysteria2",
        server: "hk-01.example.com",
        port: 443,
        password: "example-password",
        sni: "www.example.com",
        "skip-cert-verify": true,
        udp: true
      },
      {
        name: "Sample-🇸🇬-Singapore-01",
        type: "vless",
        server: "sg-01.example.com",
        port: 443,
        uuid: "00000000-0000-4000-8000-000000000001",
        tls: true,
        servername: "www.example.com",
        "skip-cert-verify": true,
        "client-fingerprint": "chrome",
        network: "tcp",
        flow: "xtls-rprx-vision",
        udp: true
      },
      {
        name: "Sample-🇯🇵-Japan-01",
        type: "trojan",
        server: "jp-01.example.com",
        port: 443,
        password: "example-password",
        sni: "www.example.com",
        "skip-cert-verify": true,
        "client-fingerprint": "chrome",
        network: "tcp",
        udp: true
      }
    ]
  };
}

function generateExampleConfig() {
  const { main } = loadBundle("scripts/override/main.js");
  return main(createSampleConfig());
}

function testMainBundle() {
  const result = generateExampleConfig();

  assert(result.dns && result.dns.enable === true, "main.js should inject dns");
  assert(Array.isArray(result["proxy-groups"]) && result["proxy-groups"].length > 0, "main.js should build proxy-groups");
  assert(result["rule-providers"] && result["rule-providers"].youtube, "main.js should build rule-providers");
  assert(
    result["rule-providers"].private.url === "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.yaml",
    "private provider URL should use MetaCubeX upstream"
  );
  assert(
    result["rule-providers"]["private-ip"].url === "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/private.yaml",
    "private-ip provider URL should use MetaCubeX upstream"
  );
  assert(!/[{}]/.test(result["rule-providers"]["e-hentai"].url), "custom provider URL should be concrete");
  assert(Array.isArray(result.rules) && result.rules.at(-1) === "MATCH,🐟 漏网之鱼", "main.js should append fallback rule");
}

function testRoutingOnlyBundle() {
  const { main } = loadBundle("scripts/override/routing-only.js");
  const input = createSampleConfig();
  input.dns = { enable: false };
  const result = main(input);

  assert(result.dns.enable === false, "routing-only.js should preserve dns");
  assert(Array.isArray(result["proxy-groups"]) && result["proxy-groups"].length > 0, "routing-only.js should build proxy-groups");
}

function testDnsOnlyBundle() {
  const { main } = loadBundle("scripts/override/dns-leak-fix.js");
  const result = main({});

  assert(result.dns && result.dns.enable === true, "dns-leak-fix.js should inject dns");
  assert(result["proxy-groups"] === undefined, "dns-leak-fix.js should not build proxy-groups");
}

function testInvalidProxyContract() {
  const { main: mainOverride } = loadBundle("scripts/override/main.js");
  const { main: routingOnly } = loadBundle("scripts/override/routing-only.js");

  let mainLogs = [];
  const mainResult = withCapturedConsoleLogs((capturedLogs) => {
    mainLogs = capturedLogs;
    return mainOverride({ proxies: [{}] });
  });
  assert(mainResult.dns && mainResult.dns.enable === true, "main.js should downgrade nameless proxies to dns-only");
  assert(mainResult["proxy-groups"] === undefined, "main.js should not build groups for nameless proxies");
  assert(
    mainLogs.some((line) => line.includes("降级为 DNS-only 模式")),
    "main.js should log dns-only downgrade diagnostics"
  );

  const routingInput = { proxies: [{}], dns: { enable: false } };
  let routingLogs = [];
  const routingResult = withCapturedConsoleLogs((capturedLogs) => {
    routingLogs = capturedLogs;
    return routingOnly(routingInput);
  });
  assert(routingResult.dns.enable === false, "routing-only.js should preserve dns on nameless proxies");
  assert(routingResult["proxy-groups"] === undefined, "routing-only.js should not build groups for nameless proxies");
  assert(
    routingLogs.some((line) => line.includes("routing-only 入口不碰 DNS 和运行时字段")),
    "routing-only.js should log passthrough downgrade diagnostics"
  );
}

function testRegionValidation() {
  const { GROUP_DEFINITIONS } = require(path.resolve(REPO_ROOT, "scripts/_lib/group-definitions.js"));
  const { validate } = require(path.resolve(REPO_ROOT, "scripts/_lib/validator.js"));
  const result = generateExampleConfig();

  result["proxy-groups"] = result["proxy-groups"].map((group) =>
    group.name === "🇭🇰 香港" ? { ...group, proxies: [] } : group
  );

  let didThrow = false;

  try {
    validate(result, GROUP_DEFINITIONS);
  } catch (error) {
    didThrow = /Empty region group should not be generated/.test(error.message);
  }

  assert(didThrow, "validator should reject empty region groups");
}

function resolveExampleOutputTarget(argv) {
  const optionIndex = argv.indexOf("--emit-example-config");
  if (optionIndex === -1) {
    return null;
  }

  const nextArg = argv[optionIndex + 1];
  if (!nextArg || nextArg.startsWith("--")) {
    return DEFAULT_EXAMPLE_OUTPUT_PATH;
  }

  if (nextArg === "-") {
    return "-";
  }

  return path.resolve(process.cwd(), nextArg);
}

function writeStatus(message, outputTarget) {
  if (outputTarget === "-") {
    process.stderr.write(`${message}\n`);
    return;
  }

  console.log(message);
}

function emitExampleConfig(outputTarget) {
  const yaml = stringifyYaml(generateExampleConfig());

  if (outputTarget === "-") {
    process.stdout.write(`${yaml}\n`);
    return;
  }

  fs.mkdirSync(path.dirname(outputTarget), { recursive: true });
  fs.writeFileSync(outputTarget, `${yaml}\n`);

  const displayPath = outputTarget.startsWith(REPO_ROOT)
    ? path.relative(REPO_ROOT, outputTarget)
    : outputTarget;

  writeStatus(`Wrote example config to ${displayPath}`, outputTarget);
}

function main(argv = process.argv.slice(2)) {
  const outputTarget = resolveExampleOutputTarget(argv);

  assertBundlePurity("scripts/override/main.js");
  assertBundlePurity("scripts/override/routing-only.js");
  assertBundlePurity("scripts/override/dns-leak-fix.js");
  testMainBundle();
  testRoutingOnlyBundle();
  testDnsOnlyBundle();
  testInvalidProxyContract();
  testRegionValidation();
  writeStatus("Smoke tests passed", outputTarget);

  if (outputTarget !== null) {
    emitExampleConfig(outputTarget);
  }
}

main();

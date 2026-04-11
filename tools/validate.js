"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { GROUP_DEFINITIONS, RULE_SET_GROUP_IDS } = require("../scripts/_lib/group-definitions");
const { buildRuleProviders } = require("../scripts/_lib/rule-builder");
const { loadRulePayloadFromFile, loadSourcesFromFile } = require("./yaml-lite");

const ALLOWED_SOURCE_KINDS = new Set(["geosite", "geoip", "custom", "provided"]);
const ALLOWED_BEHAVIORS = new Set(["domain", "ipcidr", "classical"]);
const ALLOWED_FORMATS = new Set(["yaml", "text", "mrs"]);
const ALLOWED_RULE_TYPES = new Set([
  "DOMAIN",
  "DOMAIN-SUFFIX",
  "DOMAIN-KEYWORD",
  "IP-CIDR",
  "IP-CIDR6"
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateSourcesData(sources) {
  const seenIds = new Set();
  const coveredGroups = new Set();

  for (const source of sources) {
    assert(typeof source.id === "string" && source.id.length > 0, "source.id is required");
    assert(!seenIds.has(source.id), `Duplicate source id: ${source.id}`);
    seenIds.add(source.id);

    assert(ALLOWED_SOURCE_KINDS.has(source.source_kind), `Unsupported source_kind: ${source.id}`);
    assert(ALLOWED_BEHAVIORS.has(source.behavior), `Unsupported behavior: ${source.id}`);
    assert(ALLOWED_FORMATS.has(source.format), `Unsupported format: ${source.id}`);
    assert(typeof source.url === "string" && /^https?:\/\//.test(source.url), `Invalid URL: ${source.id}`);
    assert(!/[{}]/.test(source.url), `Unresolved URL placeholder: ${source.id}`);
    assert(!/%7B|%7D/i.test(source.url), `Encoded URL placeholder: ${source.id}`);
    assert(
      Object.prototype.hasOwnProperty.call(GROUP_DEFINITIONS, source.target_group),
      `Unknown target_group: ${source.target_group} (${source.id})`
    );

    coveredGroups.add(source.target_group);
  }

  for (const groupId of RULE_SET_GROUP_IDS) {
    assert(coveredGroups.has(groupId), `Missing source coverage for group: ${groupId}`);
  }

  buildRuleProviders(GROUP_DEFINITIONS, sources);
}

function validateRuleFile(filePath) {
  const { payload } = loadRulePayloadFromFile(filePath);

  assert(Array.isArray(payload) && payload.length > 0, `Missing payload entries in ${filePath}`);

  for (const entry of payload) {
    const ruleType = String(entry).split(",")[0];
    assert(ALLOWED_RULE_TYPES.has(ruleType), `Unsupported rule type ${ruleType} in ${filePath}`);
  }
}

function findRuleFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath)
    .filter((fileName) => fileName.endsWith(".yaml"))
    .sort()
    .map((fileName) => path.join(directoryPath, fileName));
}

async function checkRemoteUrls(sources) {
  for (const source of sources) {
    try {
      const response = await fetch(source.url, { method: "HEAD" });
      if (!response.ok) {
        console.warn(`[warn] ${source.id}: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.warn(`[warn] ${source.id}: ${error.message}`);
    }
  }
}

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const sourcesFile = path.join(repoRoot, "rules", "sources.yaml");
  const sources = loadSourcesFromFile(sourcesFile).sources;

  validateSourcesData(sources);

  for (const filePath of findRuleFiles(path.join(repoRoot, "rules", "custom"))) {
    validateRuleFile(filePath);
  }

  for (const filePath of findRuleFiles(path.join(repoRoot, "rules", "provided"))) {
    validateRuleFile(filePath);
  }

  if (process.argv.includes("--check-urls")) {
    await checkRemoteUrls(sources);
  }

  console.log(`Validated ${sources.length} rule sources`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

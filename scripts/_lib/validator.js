"use strict";

const VALIDATOR_PROXY_SELECT_NAME = "🚀 代理选择";
const VALIDATOR_MANUAL_SELECT_NAME = "🔧 手动选择";
const VALIDATOR_AUTO_SELECT_NAME = "⚡ 自动选择";

function validatorBuildTargetsByMode(regionGroupNames, mode) {
  if (mode === "full") {
    return [
      VALIDATOR_PROXY_SELECT_NAME,
      ...regionGroupNames,
      VALIDATOR_MANUAL_SELECT_NAME,
      VALIDATOR_AUTO_SELECT_NAME,
      "DIRECT"
    ];
  }

  if (mode === "direct") {
    return ["DIRECT", VALIDATOR_PROXY_SELECT_NAME];
  }

  if (mode === "reject") {
    return ["REJECT", "DIRECT"];
  }

  throw new Error(`Unsupported validator mode: ${mode}`);
}

function findRegionGroups(proxyGroups, definitionNames) {
  return proxyGroups
    .filter((group) => group && typeof group.name === "string")
    .filter((group) => !definitionNames.has(group.name))
    .filter((group) => group.name !== VALIDATOR_PROXY_SELECT_NAME)
    .filter((group) => group.name !== VALIDATOR_MANUAL_SELECT_NAME)
    .filter((group) => group.name !== VALIDATOR_AUTO_SELECT_NAME)
    .filter((group) => group.type === "select");
}

function validateRegionGroups(regionGroups, allProxyNames) {
  for (const group of regionGroups) {
    if (!Array.isArray(group.proxies) || group.proxies.length === 0) {
      throw new Error(`Empty region group should not be generated: ${group.name}`);
    }

    for (const proxyName of group.proxies) {
      if (!allProxyNames.has(proxyName)) {
        throw new Error(`Region group ${group.name} references unknown proxy ${proxyName}`);
      }
    }
  }
}

function validateRuleTargets(rules, proxyGroupNames) {
  for (const rule of rules) {
    if (typeof rule !== "string" || !rule.startsWith("RULE-SET,")) {
      continue;
    }

    const parts = rule.split(",");
    const targetGroupName = parts[2];

    if (!proxyGroupNames.has(targetGroupName)) {
      throw new Error(`RULE-SET references missing proxy group: ${targetGroupName}`);
    }
  }
}

function validateBusinessGroupPurity(proxyGroups, groupDefinitions, regionGroupNames) {
  for (const definition of Object.values(groupDefinitions)) {
    const group = proxyGroups.find((candidate) => candidate.name === definition.name);
    if (!group) {
      throw new Error(`Missing configured proxy group: ${definition.name}`);
    }

    const allowedTargets = new Set(validatorBuildTargetsByMode(regionGroupNames, definition.mode));

    for (const proxyName of group.proxies || []) {
      if (!allowedTargets.has(proxyName)) {
        throw new Error(
          `Configured group ${definition.name} contains unsupported target ${proxyName}`
        );
      }
    }
  }
}

function validate(config, groupDefinitions) {
  const proxyGroups = Array.isArray(config["proxy-groups"]) ? config["proxy-groups"] : [];
  const rules = Array.isArray(config.rules) ? config.rules : [];

  if (proxyGroups.length === 0) {
    throw new Error("Missing proxy-groups");
  }

  if (rules.length === 0) {
    throw new Error("Missing rules");
  }

  const proxyGroupNames = new Set(proxyGroups.map((group) => group.name));
  const definitionNames = new Set(Object.values(groupDefinitions).map((definition) => definition.name));
  const allProxyNames = new Set(
    (config.proxies || [])
      .map((proxy) => proxy && proxy.name)
      .filter((name) => typeof name === "string" && name.length > 0)
  );

  validateRuleTargets(rules, proxyGroupNames);

  const regionGroups = findRegionGroups(proxyGroups, definitionNames);
  validateRegionGroups(regionGroups, allProxyNames);
  const regionGroupNames = regionGroups.map((group) => group.name);
  validateBusinessGroupPurity(proxyGroups, groupDefinitions, regionGroupNames);
}

if (typeof module !== "undefined") {
  module.exports = {
    validate
  };
}

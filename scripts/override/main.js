import ruleProvidersConfig from "../config/rules/ruleProviders.js";
import groupDefinitionsConfig from "../config/rules/groupDefinitions.js";
import { buildProxyGroups, getNamedProxies } from "./lib/proxy-groups.js";
import { assembleRuleSet } from "./lib/rule-assembly.js";
import { applyRuntimePreset } from "./lib/runtime-preset.js";
import { validateOutput } from "./lib/validate-output.js";

const { ruleProviders } = ruleProvidersConfig;
const { groupDefinitions } = groupDefinitionsConfig;

function main(config = {}) {
  const workingConfig = config && typeof config === "object" ? config : {};
  const proxies = Array.isArray(workingConfig.proxies) ? workingConfig.proxies : [];
  const namedProxies = getNamedProxies(proxies);

  applyRuntimePreset(workingConfig);

  if (namedProxies.length === 0) {
    console.log("[override] ERROR: config.proxies 为空，无法生成策略组和分流规则");
    console.log("[override] 已应用 runtime preset，跳过 proxy-groups、rule-providers 和 rules 生成");
    return workingConfig;
  }

  workingConfig["proxy-groups"] = buildProxyGroups(namedProxies, groupDefinitions);

  const { providers, rules } = assembleRuleSet(groupDefinitions, ruleProviders);
  workingConfig["rule-providers"] = providers;
  workingConfig.rules = rules;

  validateOutput(workingConfig, groupDefinitions);
  return workingConfig;
}

export { main };

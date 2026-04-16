import ruleProvidersConfig from "../config/rules/ruleProviders.js";
import groupDefinitionsConfig from "../config/proxy-groups/groupDefinitions.js";
import inlineRulesConfig from "../config/rules/inlineRules.js";
import chainsConfig from "../config/proxy-groups/chains.js";
import { buildProxyGroups, getNamedProxies } from "./lib/proxy-groups.js";
import { assembleRuleSet } from "./lib/rule-assembly.js";
import { applyRuntimePreset } from "./lib/runtime-preset.js";
import { validateOutput } from "./lib/validate-output.js";
import {
  applyProxyChains,
  buildChainGroups,
  buildTransitGroups,
  validateChainsSchema,
} from "./lib/proxy-chains.js";

const { ruleProviders } = ruleProvidersConfig;
const { groupDefinitions } = groupDefinitionsConfig;
const transitDefinitions = Array.isArray(chainsConfig.transit_group) ? chainsConfig.transit_group : [];
const chainDefinitions = Array.isArray(chainsConfig.chain_group) ? chainsConfig.chain_group : [];

// 模块加载期执行 schema 校验：entry 必须引用已定义的 transit_group.id
validateChainsSchema(chainDefinitions, transitDefinitions);

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

  const { chainGroups, remainingProxies } = buildChainGroups(namedProxies, chainDefinitions);
  const { groups: transitGroups, idToName: transitIdToName } = buildTransitGroups(
    remainingProxies,
    transitDefinitions,
  );

  // 所有 transit_group 均为空 → 整体跳过链式代理
  const chainsEffective = transitGroups.length > 0 && chainGroups.length > 0;

  workingConfig["proxy-groups"] = buildProxyGroups(remainingProxies, groupDefinitions, {
    chainGroups: chainsEffective ? chainGroups : [],
    transitGroups: chainsEffective ? transitGroups : [],
  });

  if (chainsEffective) {
    applyProxyChains(workingConfig, chainDefinitions, transitIdToName);
  }

  const { providers, rules } = assembleRuleSet(groupDefinitions, ruleProviders, inlineRulesConfig);
  workingConfig["rule-providers"] = providers;
  workingConfig.rules = rules;

  validateOutput(workingConfig, groupDefinitions, { chainDefinitions, transitDefinitions });
  return workingConfig;
}

export { main };

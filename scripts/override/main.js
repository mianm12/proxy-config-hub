"use strict";

const { applyBaseConfig, ensureBaseRuntime } = require("../_lib/base-config");
const { applyDnsConfig } = require("../_lib/dns-preset");
const { GROUP_DEFINITIONS, GROUP_ORDER } = require("../_lib/group-definitions");
const { buildProxyGroups, getNamedProxies } = require("../_lib/proxy-utils");
const { buildRuleProviders } = require("../_lib/rule-builder");
const { validate } = require("../_lib/validator");

const SOURCES_DATA = __SOURCES_DATA__;

function main(config) {
  const workingConfig = config && typeof config === "object" ? config : {};
  const proxies = Array.isArray(workingConfig.proxies) ? workingConfig.proxies : [];
  const namedProxies = getNamedProxies(proxies);

  if (namedProxies.length === 0) {
    console.log("[override] ERROR: config.proxies 为空，无法生成策略组和分流规则");
    console.log("[override] 降级为 DNS-only 模式，仅注入 DNS 防泄漏，其他字段保留上游原样");
    applyDnsConfig(workingConfig);
    return workingConfig;
  }

  applyBaseConfig(workingConfig);
  applyDnsConfig(workingConfig);
  ensureBaseRuntime(workingConfig);

  workingConfig["proxy-groups"] = buildProxyGroups(namedProxies, GROUP_DEFINITIONS, GROUP_ORDER);

  const { providers, rules } = buildRuleProviders(GROUP_DEFINITIONS, SOURCES_DATA);
  workingConfig["rule-providers"] = providers;
  workingConfig.rules = rules;

  validate(workingConfig, GROUP_DEFINITIONS);

  return workingConfig;
}

if (typeof module !== "undefined") {
  module.exports = { main };
}

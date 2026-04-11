"use strict";

// @bundle-inline ../_lib/base-config.js
// @bundle-inline ../_lib/dns-preset.js
// @bundle-inline ../_lib/group-definitions.js
// @bundle-inline ../_lib/proxy-utils.js
// @bundle-inline ../_lib/rule-builder.js
// @bundle-inline ../_lib/validator.js

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

import { extractRuleTarget } from "./rule-assembly.js";

/**
 * 校验生成配置的完整性和正确性。
 * 检查 proxy-groups 结构、规则引用、MATCH 位置等。
 * @param {Record<string, unknown>} config - 生成后的配置对象。
 * @param {Record<string, {name: string}>} groupDefinitions - 策略组定义。
 * @returns {void}
 */
function validateOutput(config, groupDefinitions) {
  const proxyGroups = Array.isArray(config["proxy-groups"]) ? config["proxy-groups"] : [];
  const rules = Array.isArray(config.rules) ? config.rules : [];

  if (!groupDefinitions.fallback) {
    throw new Error("策略组定义中缺少 fallback 组");
  }

  const fallbackName = groupDefinitions.fallback.name;

  if (!fallbackName) {
    throw new Error("fallback 策略组缺少 name 字段");
  }

  if (!proxyGroups.length) {
    throw new Error("缺少 proxy-groups");
  }

  if (!rules.length) {
    throw new Error("缺少 rules");
  }

  const proxyGroupNames = new Set(proxyGroups.map((group) => group.name));

  for (const definition of Object.values(groupDefinitions)) {
    if (!proxyGroupNames.has(definition.name)) {
      throw new Error(`缺少已配置的策略组: ${definition.name}`);
    }
  }

  for (const group of proxyGroups) {
    if (!Array.isArray(group.proxies) || group.proxies.length === 0) {
      throw new Error(`策略组节点为空: ${group.name}`);
    }

    for (const target of group.proxies) {
      if (typeof target === "string" && target.startsWith("@")) {
        throw new Error(`策略组 ${group.name} 中存在未展开的占位符: ${target}`);
      }
    }
  }

  let matchRuleFound = false;

  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    if (typeof rule !== "string") {
      throw new Error(`规则类型无效（索引 ${index}）`);
    }

    if (rule.startsWith("RULE-SET,")) {
      const targetGroupName = extractRuleTarget(rule);

      if (!proxyGroupNames.has(targetGroupName)) {
        throw new Error(`RULE-SET 引用了不存在的策略组: ${targetGroupName}`);
      }

      continue;
    }

    if (rule.startsWith("MATCH,")) {
      if (index !== rules.length - 1) {
        throw new Error("MATCH 规则必须位于最后一条");
      }

      if (rule !== `MATCH,${fallbackName}`) {
        throw new Error(`MATCH 规则必须指向 fallback 策略组: ${fallbackName}`);
      }

      matchRuleFound = true;
    }
  }

  if (!matchRuleFound) {
    throw new Error("缺少 fallback MATCH 规则");
  }
}

export { validateOutput };

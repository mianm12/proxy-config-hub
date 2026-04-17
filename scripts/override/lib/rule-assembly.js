import placeholdersConfig from "../../config/proxy-groups/placeholders.js";

const BUILTIN_RULE_TARGETS = new Set([
  "COMPATIBLE",
  "DIRECT",
  "DNS",
  "PASS",
  "REJECT",
  "REJECT-DROP",
]);

const RULE_TRAILING_OPTIONS = new Set(["no-resolve"]);

/**
 * 兜底策略组 ID。来源于 placeholders.yaml 的 fallback 字段，
 * 用于 MATCH 规则与缺失校验，避免在多个文件中硬编码字面量。
 */
const FALLBACK_GROUP_ID = placeholdersConfig.fallback;

/**
 * 提取 prepend 规则指向的目标策略组名称。
 * Mihomo 规则的可选尾缀修饰项目前仅有 `no-resolve` 会出现在目标策略组之后，
 * 因此 `RULE_TRAILING_OPTIONS` 只收录该值；普通规则的目标策略组位于倒数第一段，
 * 带 `no-resolve` 尾缀时目标策略组位于倒数第二段。
 * @param {string} rule 需要解析的单条规则字符串。
 * @returns {string} 规则引用的目标策略组或内置目标名称。
 */
function extractRuleTarget(rule) {
  const parts = rule.split(",").map((part) => part.trim());

  if (parts.length < 2) {
    throw new Error(`Prepend rule must contain a target: ${rule}`);
  }

  const lastPart = parts.at(-1);
  if (RULE_TRAILING_OPTIONS.has(lastPart.toLowerCase())) {
    if (parts.length < 3) {
      throw new Error(`Prepend rule must contain a target before trailing option: ${rule}`);
    }

    return parts.at(-2);
  }

  return lastPart;
}

/**
 * 规范化并校验 prependRules，确保规则字符串与目标策略组引用合法。
 * Mihomo 规则的可选尾缀修饰项目前仅有 `no-resolve` 会出现在目标策略组之后，
 * 因此目标策略组应取倒数第一段，或在带 `no-resolve` 尾缀时取倒数第二段。
 * @param {{ prependRules?: string[] }} [inlineRules={}] 内联规则配置。
 * @param {Record<string, { name?: string }>} [groupDefinitions={}] 已声明的策略组定义。
 * @returns {string[]} 规范化后的 prepend 规则数组。
 */
function normalizePrependRules(inlineRules = {}, groupDefinitions = {}) {
  const { prependRules } = inlineRules;

  if (prependRules === undefined) {
    return [];
  }

  if (!Array.isArray(prependRules)) {
    throw new Error("inlineRules.prependRules must be an array");
  }

  const validGroupTargets = new Set(
    Object.values(groupDefinitions)
      .map((definition) => definition?.name)
      .filter((name) => typeof name === "string" && name.length > 0),
  );

  return prependRules.map((rule, index) => {
    if (typeof rule !== "string") {
      throw new Error(`Invalid prepend rule type at index ${index}`);
    }

    const normalizedRule = rule.trim();

    if (!normalizedRule) {
      throw new Error(`Prepend rule must not be empty at index ${index}`);
    }

    if (normalizedRule.startsWith("MATCH,")) {
      throw new Error(`Prepend rule must not be MATCH at index ${index}`);
    }

    const target = extractRuleTarget(normalizedRule);
    if (!validGroupTargets.has(target) && !BUILTIN_RULE_TARGETS.has(target)) {
      throw new Error(`Prepend rule references unknown target at index ${index}: ${target}`);
    }

    return normalizedRule;
  });
}

function assembleRuleSet(groupDefinitions, ruleProviders, inlineRules) {
  const providers = {};
  const rules = normalizePrependRules(inlineRules, groupDefinitions);

  for (const [providerId, providerDefinition] of Object.entries(ruleProviders)) {
    const targetGroupId = providerDefinition["target-group"];
    const targetGroup = groupDefinitions[targetGroupId];

    if (!targetGroup) {
      throw new Error(`Unknown target-group for ${providerId}: ${targetGroupId}`);
    }

    const provider = {};
    for (const [key, value] of Object.entries(providerDefinition)) {
      if (key === "target-group" || key === "no-resolve") {
        continue;
      }

      provider[key] = value;
    }

    providers[providerId] = provider;
    rules.push(
      providerDefinition["no-resolve"]
        ? `RULE-SET,${providerId},${targetGroup.name},no-resolve`
        : `RULE-SET,${providerId},${targetGroup.name}`,
    );
  }

  if (!groupDefinitions[FALLBACK_GROUP_ID]?.name) {
    throw new Error(`Missing fallback group definition: ${FALLBACK_GROUP_ID}`);
  }

  rules.push(`MATCH,${groupDefinitions[FALLBACK_GROUP_ID].name}`);
  return { providers, rules };
}

export { assembleRuleSet, extractRuleTarget };

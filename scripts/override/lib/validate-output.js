import { extractRuleTarget } from "./rule-assembly.js";

/**
 * 校验生成配置的完整性和正确性。
 * 检查 proxy-groups 结构、规则引用、MATCH 位置等。
 * @param {Record<string, unknown>} config - 生成后的配置对象。
 * @param {Record<string, {name: string}>} groupDefinitions - 策略组定义。
 * @param {{chainDefinitions?: Array, transitDefinitions?: Array}} [chainsContext]
 *   可选链式代理上下文：用于执行 spec §7.2（transit 不得含 landing）/ §7.3（chain_group 非空）断言。
 *   省略时跳过这两项断言。
 * @returns {void}
 */
function validateOutput(config, groupDefinitions, chainsContext = {}) {
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

  // §7.2 / §7.3: chain/transit 不变量断言（仅当 chainsContext 提供时）
  const chainDefs = Array.isArray(chainsContext.chainDefinitions) ? chainsContext.chainDefinitions : [];
  const transitDefs = Array.isArray(chainsContext.transitDefinitions) ? chainsContext.transitDefinitions : [];

  if (chainDefs.length > 0 || transitDefs.length > 0) {
    const chainGroupNames = new Set();
    const compiledLandingPatterns = [];
    for (const chain of chainDefs) {
      if (typeof chain?.name === "string") {
        chainGroupNames.add(chain.name);
      }
      if (typeof chain?.landing_pattern === "string" && chain.landing_pattern.length > 0) {
        try {
          compiledLandingPatterns.push(new RegExp(chain.landing_pattern, chain.flags || ""));
        } catch (error) {
          throw new Error(
            `chain_group ${chain.id} 的 landing_pattern 非法正则: ${error.message}`,
          );
        }
      }
    }
    const transitGroupNames = new Set();
    for (const transit of transitDefs) {
      if (typeof transit?.name === "string") {
        transitGroupNames.add(transit.name);
      }
    }

    for (const group of proxyGroups) {
      // §7.3: chain_group.proxies 必须非空
      if (chainGroupNames.has(group.name)) {
        if (!Array.isArray(group.proxies) || group.proxies.length === 0) {
          throw new Error(`chain_group ${group.name} 的 proxies 不得为空`);
        }
      }
      // §7.2: transit_group 成员不得命中任何 chain_group.landing_pattern
      if (transitGroupNames.has(group.name)) {
        const members = Array.isArray(group.proxies) ? group.proxies : [];
        for (const memberName of members) {
          if (typeof memberName !== "string") continue;
          for (const pattern of compiledLandingPatterns) {
            if (pattern.test(memberName)) {
              throw new Error(
                `transit_group ${group.name} 成员 ${memberName} 命中 landing_pattern，违反防环不变量`,
              );
            }
          }
        }
      }
    }
  }

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

  // 链式代理一致性校验
  const proxies = Array.isArray(config.proxies) ? config.proxies : [];
  for (const proxy of proxies) {
    const dialerTarget = proxy?.["dialer-proxy"];
    if (dialerTarget === undefined) {
      continue;
    }
    if (typeof dialerTarget !== "string" || dialerTarget.length === 0) {
      throw new Error(`proxy ${proxy?.name} 的 dialer-proxy 类型非法`);
    }
    if (!proxyGroupNames.has(dialerTarget)) {
      throw new Error(
        `proxy ${proxy?.name} 的 dialer-proxy 指向不存在的策略组: ${dialerTarget}`,
      );
    }
  }
}

export { validateOutput };

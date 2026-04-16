/**
 * 将 chain_group 定义中的 landing_pattern 编译为 RegExp。
 * @param {Array<{id:string, landing_pattern:string, flags?:string}>} chainDefinitions
 * @returns {Array<{definition:object, pattern:RegExp}>}
 */
function compileChainPatterns(chainDefinitions) {
  return chainDefinitions.map((definition) => {
    if (typeof definition.landing_pattern !== "string" || definition.landing_pattern.length === 0) {
      throw new Error(`chain_group ${definition.id} 缺少非空的 landing_pattern`);
    }

    try {
      return {
        definition,
        pattern: new RegExp(definition.landing_pattern, definition.flags || ""),
      };
    } catch (error) {
      throw new Error(
        `chain_group ${definition.id} 的 landing_pattern 非法正则: ${error.message}`,
      );
    }
  });
}

/**
 * 校验 chain_group 的 id 唯一性。
 * @param {Array<{id:string}>} chainDefinitions
 * @returns {void}
 */
function assertUniqueChainIds(chainDefinitions) {
  const seen = new Set();
  for (const definition of chainDefinitions) {
    if (typeof definition.id !== "string" || definition.id.length === 0) {
      throw new Error("chain_group 条目缺少非空的 id");
    }
    if (seen.has(definition.id)) {
      throw new Error(`chain_group.id 重复: ${definition.id}`);
    }
    seen.add(definition.id);
  }
}

/**
 * 提取 landing 节点并按 chain_group 定义构建组。
 * 节点匹配采用 first-match-wins：按 chain_group 数组顺序，节点归属首个命中的组。
 * 被首个组捕获后，若又命中其他组的 landing_pattern，记录 WARN（仅归属首个）。
 * 成员为空的 chain_group 会被跳过并 WARN。
 *
 * @param {Array<{name:string}>} namedProxies - 已过滤非空名称的节点数组。
 * @param {Array<{id:string, name:string, landing_pattern:string, flags?:string, entry:string, type:string}>} chainDefinitions
 * @returns {{chainGroups: Array<{name:string, type:string, proxies:string[]}>, remainingProxies: Array<{name:string}>}}
 */
function buildChainGroups(namedProxies, chainDefinitions) {
  if (!Array.isArray(chainDefinitions) || chainDefinitions.length === 0) {
    return { chainGroups: [], remainingProxies: [...namedProxies] };
  }

  assertUniqueChainIds(chainDefinitions);
  const compiled = compileChainPatterns(chainDefinitions);

  const bucketsByChainId = new Map(compiled.map((entry) => [entry.definition.id, []]));
  const remainingProxies = [];

  for (const proxy of namedProxies) {
    let captured = false;
    for (const entry of compiled) {
      if (entry.pattern.test(proxy.name)) {
        if (!captured) {
          bucketsByChainId.get(entry.definition.id).push(proxy);
          captured = true;
          continue;
        }
        console.log(
          `[override] WARN: 节点 ${proxy.name} 同时命中 chain_group ${entry.definition.id} 的 landing_pattern，已忽略（首个命中的 chain_group 已捕获）`,
        );
      }
    }
    if (!captured) {
      remainingProxies.push(proxy);
    }
  }

  const chainGroups = [];
  for (const entry of compiled) {
    const bucket = bucketsByChainId.get(entry.definition.id);
    if (bucket.length === 0) {
      console.log(
        `[override] WARN: chain_group ${entry.definition.id} 未命中任何节点，已跳过该组`,
      );
      continue;
    }
    chainGroups.push({
      name: entry.definition.name,
      type: entry.definition.type,
      proxies: bucket.map((proxy) => proxy.name),
    });
  }

  return { chainGroups, remainingProxies };
}

export { buildChainGroups };

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
 * 静态 schema 校验：每个 chain.entry 必须等于某个已定义的 transit_group.id。
 * 本校验独立于运行时成员是否为空，用于区分 "YAML 拼写错误"（schema 错误）
 * 与 "transit 成员空被跳过"（运行时退化）两种场景。
 *
 * @param {Array<{id:string, entry:string}>} chainDefinitions
 * @param {Array<{id:string}>} transitDefinitions
 * @returns {void}  合法时无返回值；不合法时抛 Error。
 */
function validateChainsSchema(chainDefinitions, transitDefinitions) {
  if (!Array.isArray(chainDefinitions) || chainDefinitions.length === 0) {
    return;
  }
  if (!Array.isArray(transitDefinitions)) {
    throw new Error("transit_group 必须是数组");
  }

  const definedTransitIds = new Set();
  for (const definition of transitDefinitions) {
    if (typeof definition?.id === "string" && definition.id.length > 0) {
      definedTransitIds.add(definition.id);
    }
  }

  for (const chain of chainDefinitions) {
    if (typeof chain?.entry !== "string" || chain.entry.length === 0) {
      throw new Error(`chain_group ${chain?.id} 缺少非空的 entry 字段`);
    }
    if (!definedTransitIds.has(chain.entry)) {
      throw new Error(
        `chain_group ${chain.id} 的 entry=${chain.entry} 未在 transit_group 中定义`,
      );
    }
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

/**
 * 校验 transit_group 的 id 唯一性。
 * @param {Array<{id:string}>} transitDefinitions
 * @returns {void}
 */
function assertUniqueTransitIds(transitDefinitions) {
  const seen = new Set();
  for (const definition of transitDefinitions) {
    if (typeof definition.id !== "string" || definition.id.length === 0) {
      throw new Error("transit_group 条目缺少非空的 id");
    }
    if (seen.has(definition.id)) {
      throw new Error(`transit_group.id 重复: ${definition.id}`);
    }
    seen.add(definition.id);
  }
}

/**
 * 将 transit_pattern 编译为 RegExp；空字符串表示不过滤（返回 null）。
 * @param {string} pattern
 * @param {string} flags
 * @param {string} transitId
 * @returns {RegExp|null}
 */
function compileTransitPattern(pattern, flags, transitId) {
  if (typeof pattern !== "string" || pattern.length === 0) {
    return null;
  }
  try {
    return new RegExp(pattern, flags || "");
  } catch (error) {
    throw new Error(
      `transit_group ${transitId} 的 transit_pattern 非法正则: ${error.message}`,
    );
  }
}

/**
 * 基于剔除 landing 后的剩余节点构建 transit_groups。
 * 空 transit_pattern → 成员为 remainingProxies 全部；非空时做正则过滤。
 * 成员为空的 transit_group 会被跳过（WARN）并不出现在 idToName 中。
 *
 * @param {Array<{name:string}>} remainingProxies
 * @param {Array<{id:string, name:string, transit_pattern:string, flags?:string, type:string}>} transitDefinitions
 * @returns {{groups: Array<{name:string, type:string, proxies:string[]}>, idToName: Map<string,string>}}
 */
function buildTransitGroups(remainingProxies, transitDefinitions) {
  if (!Array.isArray(transitDefinitions) || transitDefinitions.length === 0) {
    return { groups: [], idToName: new Map() };
  }

  assertUniqueTransitIds(transitDefinitions);

  const groups = [];
  const idToName = new Map();

  for (const definition of transitDefinitions) {
    const compiledPattern = compileTransitPattern(
      definition.transit_pattern,
      definition.flags,
      definition.id,
    );
    const members = compiledPattern
      ? remainingProxies.filter((proxy) => compiledPattern.test(proxy.name))
      : [...remainingProxies];

    if (members.length === 0) {
      console.log(
        `[override] WARN: transit_group ${definition.id} 过滤后无可用节点，已跳过该组`,
      );
      continue;
    }

    groups.push({
      name: definition.name,
      type: definition.type,
      proxies: members.map((proxy) => proxy.name),
    });
    idToName.set(definition.id, definition.name);
  }

  return { groups, idToName };
}

/**
 * 为 config.proxies 中命中 landing_pattern 的节点注入 dialer-proxy = transit.name。
 * 行为：
 *   - 对每个 chain：若 transitIdToName.get(chain.entry) 未定义，WARN 并跳过该 chain。
 *   - 否则遍历 config.proxies：
 *       - 匹配 landing_pattern 且无 dialer-proxy → 注入 proxy["dialer-proxy"] = transit.name
 *       - 已有 dialer-proxy → 保留原值 + WARN
 *
 * @param {{proxies: Array<object>}} config
 * @param {Array<{id:string, landing_pattern:string, flags?:string, entry:string}>} chainDefinitions
 * @param {Map<string,string>} transitIdToName - 来自 buildTransitGroups 的 idToName
 * @returns {void}
 */
function applyProxyChains(config, chainDefinitions, transitIdToName) {
  if (!Array.isArray(chainDefinitions) || chainDefinitions.length === 0) {
    return;
  }

  const proxies = Array.isArray(config.proxies) ? config.proxies : [];

  for (const chain of chainDefinitions) {
    const transitName = transitIdToName.get(chain.entry);
    if (!transitName) {
      console.log(
        `[override] WARN: chain ${chain.id} 的 entry=${chain.entry} 未找到已构建的 transit_group，跳过注入`,
      );
      continue;
    }

    let pattern;
    try {
      pattern = new RegExp(chain.landing_pattern, chain.flags || "");
    } catch (error) {
      throw new Error(
        `chain ${chain.id} 的 landing_pattern 非法正则: ${error.message}`,
      );
    }

    for (const proxy of proxies) {
      if (typeof proxy?.name !== "string" || !pattern.test(proxy.name)) {
        continue;
      }
      if (proxy["dialer-proxy"] !== undefined) {
        console.log(
          `[override] WARN: 节点 ${proxy.name} 已有 dialer-proxy=${proxy["dialer-proxy"]}，保留原值不覆盖`,
        );
        continue;
      }
      proxy["dialer-proxy"] = transitName;
    }
  }
}

export { applyProxyChains, buildChainGroups, buildTransitGroups, validateChainsSchema };

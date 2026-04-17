import regionsConfig from "../../config/proxy-groups/regions.js";
import placeholdersConfig from "../../config/proxy-groups/placeholders.js";
import { cloneData } from "./utils.js";

/**
 * 将 YAML 加载的区域配置编译为包含 RegExp 对象的运行时格式。
 * 在模块加载时执行一次，后续匹配直接使用编译后的正则。
 * @param {Array<{id: string, name: string, icon: string, pattern: string, flags?: string}>} rawRegions
 * @returns {Array<{id: string, name: string, icon: string, pattern: RegExp}>}
 */
function compileRegionPatterns(rawRegions) {
  return rawRegions.map((region) => ({
    id: region.id,
    name: region.name,
    icon: region.icon,
    pattern: new RegExp(region.pattern, region.flags || ""),
  }));
}

const REGION_PATTERNS = compileRegionPatterns(regionsConfig);

/**
 * 兜底 region：约定 regions.yaml 数组的最后一项是兜底，pattern 必须能
 * 匹配任意字符串（如 ".*"），用于收纳未命中前面具体国家的节点。
 * 启动期校验该约定，避免节点静默丢失。
 */
const FALLBACK_REGION = REGION_PATTERNS.at(-1);
if (!FALLBACK_REGION || !FALLBACK_REGION.pattern.test("")) {
  throw new Error(
    "regions.yaml 末项必须是兜底 region（pattern 能匹配空字符串），用于收纳未命中具体国家的节点",
  );
}

const RESERVED_GROUP_IDS = placeholdersConfig.reserved;
const FALLBACK_GROUP_ID = placeholdersConfig.fallback;
const PLACEHOLDERS = placeholdersConfig.placeholders;

/**
 * 上下文占位符（kind=context）的运行时数据解析器表。
 * key 与 placeholders.yaml 中 entry.source 的可选值一一对应；
 * value 接收 expandGroupTarget 的 context，返回展开后的名称数组。
 * 新增 source 类型时需同步更新此表与 yaml-to-js.js 的 schema 校验白名单。
 */
const CONTEXT_SOURCES = {
  allNodes: (context) => [...context.allProxyNames],
  regionGroups: (context) => [...context.regionGroupNames],
  chainGroups: (context) => [...context.chainGroupNames],
};

/**
 * 过滤出具有有效名称的代理节点。
 * @param {Array<{name?: string}>} proxies - 原始代理节点列表。
 * @returns {Array<{name: string}>} 具有非空名称的节点列表。
 */
function getNamedProxies(proxies) {
  return proxies.filter(
    (proxy) => proxy && typeof proxy.name === "string" && proxy.name.trim().length > 0,
  );
}

/**
 * 根据区域正则模式匹配代理节点名称，返回匹配到的区域 ID。
 * 采用 first-match-wins 策略: 按 REGION_PATTERNS 数组顺序依次匹配，
 * 返回第一个命中的区域 ID。由于 REGION_PATTERNS 末项是兜底（pattern=`.*`），
 * 任意非空字符串必然命中，循环不会落到末尾的防御性返回。
 * @param {string} proxyName - 代理节点名称。
 * @returns {string} 区域 ID。
 */
function detectRegionId(proxyName) {
  for (const region of REGION_PATTERNS) {
    if (region.pattern.test(proxyName)) {
      return region.id;
    }
  }

  return FALLBACK_REGION.id;
}

/**
 * 将代理节点按区域分类。
 * @param {Array<{name: string}>} proxies - 已过滤的代理节点列表。
 * @returns {Record<string, Array<{name: string}>>} 区域 ID 到节点数组的映射。
 */
function classifyProxies(proxies) {
  const regionMap = {};

  for (const proxy of proxies) {
    const regionId = detectRegionId(proxy.name);

    if (!regionMap[regionId]) {
      regionMap[regionId] = [];
    }

    regionMap[regionId].push(proxy);
  }

  return regionMap;
}

/**
 * 基于分类结果构建区域代理组列表。
 * @param {Array<{name: string}>} proxies - 已过滤的代理节点列表。
 * @returns {Array<{name: string, type: string, proxies: string[]}>} 区域组列表。
 */
function buildRegionGroups(proxies) {
  const regionMap = classifyProxies(proxies);
  const regionGroups = [];

  for (const region of REGION_PATTERNS) {
    const nodes = regionMap[region.id];
    if (!nodes || nodes.length === 0) {
      continue;
    }

    regionGroups.push({
      name: `${region.icon} ${region.name}`,
      type: "select",
      proxies: nodes.map((node) => node.name),
    });
  }

  return regionGroups;
}

/**
 * 展开 @-前缀的占位符目标为实际节点/组名列表。
 * 占位符全集声明在 placeholders.yaml 的 placeholders 字段，分两类:
 *   - kind=ref      → 返回 [groupDefinitions[entry.target].name]
 *   - kind=context  → 调用 CONTEXT_SOURCES[entry.source](context)
 * 未在 PLACEHOLDERS 中声明但以 @ 开头的目标视为非法。
 * @param {string} target - 占位符或普通目标名称。
 * @param {{allProxyNames: string[], regionGroupNames: string[], chainGroupNames: string[], groupDefinitions: Record<string, {name: string}>}} context
 * @returns {string[]} 展开后的名称列表。
 */
function expandGroupTarget(target, context) {
  const entry = PLACEHOLDERS[target];

  if (entry) {
    if (entry.kind === "ref") {
      const referencedDefinition = context.groupDefinitions[entry.target];

      if (!referencedDefinition) {
        throw new Error(`占位符 ${target} 引用了未定义的策略组: ${entry.target}`);
      }

      return [referencedDefinition.name];
    }

    if (entry.kind === "context") {
      const resolver = CONTEXT_SOURCES[entry.source];

      if (!resolver) {
        throw new Error(`占位符 ${target} 引用了未知的运行时上下文: ${entry.source}`);
      }

      return resolver(context);
    }

    throw new Error(`占位符 ${target} 的 kind 非法: ${entry.kind}`);
  }

  if (target.startsWith("@")) {
    throw new Error(`不支持的占位符: ${target}`);
  }

  return [target];
}

/**
 * 根据策略组定义构建单个代理组。
 * @param {string} groupId - 策略组 ID。
 * @param {{name: string, type: string, proxies?: string[], category?: string}} definition - 策略组定义。
 * @param {Object} context - 展开占位符所需的上下文。
 * @returns {{name: string, type: string, proxies: string[]}} 构建后的代理组。
 */
function buildConfiguredGroup(groupId, definition, context) {
  const proxies = [];
  for (const target of definition.proxies || []) {
    proxies.push(...expandGroupTarget(target, context));
  }

  const group = {};
  for (const [key, value] of Object.entries(definition)) {
    if (key === "category" || key === "proxies") {
      continue;
    }

    group[key] = cloneData(value);
  }

  if (!group.name) {
    throw new Error(`策略组 ${groupId} 缺少 name 字段`);
  }

  if (!group.type) {
    throw new Error(`策略组 ${groupId} 缺少 type 字段`);
  }

  group.proxies = proxies;
  return group;
}

/**
 * 构建完整的代理组列表。
 * 顺序（自顶向下）：
 *   保留组 → chain_groups → transit_groups → 其他自定义组 → 区域组 → fallback
 * @param {Array<{name: string}>} proxies - 已过滤的代理节点列表。
 * @param {Record<string, Object>} groupDefinitions - 策略组定义。
 * @param {{chainGroups?: Array<object>, transitGroups?: Array<object>}} [extras]
 *   可选：额外插入的 chain_groups 与 transit_groups。省略或数组为空时等价于旧版行为。
 * @returns {Array<{name: string, type: string, proxies: string[]}>} 完整的代理组列表。
 */
function buildProxyGroups(proxies, groupDefinitions, extras = {}) {
  const chainGroups = Array.isArray(extras.chainGroups) ? extras.chainGroups : [];
  const transitGroups = Array.isArray(extras.transitGroups) ? extras.transitGroups : [];

  const namedProxies = getNamedProxies(proxies);
  const allProxyNames = namedProxies.map((proxy) => proxy.name);
  const regionGroups = buildRegionGroups(namedProxies);
  const chainGroupNames = chainGroups.map((group) => group.name);
  const context = {
    allProxyNames,
    regionGroupNames: regionGroups.map((group) => group.name),
    chainGroupNames,
    groupDefinitions,
  };

  const groups = [];

  // 1. 保留组
  for (const groupId of RESERVED_GROUP_IDS) {
    groups.push(buildConfiguredGroup(groupId, groupDefinitions[groupId], context));
  }

  // 2. chain_groups（落地）
  groups.push(...chainGroups);

  // 3. transit_groups（中转）
  groups.push(...transitGroups);

  // 4. 其他自定义组（非保留、非 fallback）
  for (const [groupId, definition] of Object.entries(groupDefinitions)) {
    if (RESERVED_GROUP_IDS.includes(groupId) || groupId === FALLBACK_GROUP_ID) {
      continue;
    }
    groups.push(buildConfiguredGroup(groupId, definition, context));
  }

  // 5. 区域组
  groups.push(...regionGroups);

  // 6. fallback
  groups.push(buildConfiguredGroup(FALLBACK_GROUP_ID, groupDefinitions[FALLBACK_GROUP_ID], context));

  // 组名冲突检测：chain/transit 的 name 不得与其他组重名
  const seenNames = new Set();
  for (const group of groups) {
    if (seenNames.has(group.name)) {
      throw new Error(`proxy-groups 存在重名组: ${group.name}`);
    }
    seenNames.add(group.name);
  }

  return groups;
}

export { buildProxyGroups, getNamedProxies };

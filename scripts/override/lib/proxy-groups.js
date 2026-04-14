import regionsConfig from "../../config/runtime/regions.js";
import placeholdersConfig from "../../config/runtime/placeholders.js";
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
const RESERVED_GROUP_IDS = placeholdersConfig.reserved;
const FALLBACK_GROUP_ID = placeholdersConfig.fallback;
const PLACEHOLDER_GROUP_IDS = placeholdersConfig.mappings;

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
 * 返回第一个命中的区域 ID；全部未命中则返回 "OTHER"。
 * @param {string} proxyName - 代理节点名称。
 * @returns {string} 区域 ID。
 */
function detectRegionId(proxyName) {
  for (const region of REGION_PATTERNS) {
    if (region.pattern.test(proxyName)) {
      return region.id;
    }
  }

  return "OTHER";
}

/**
 * 将代理节点按区域分类。
 * @param {Array<{name: string}>} proxies - 已过滤的代理节点列表。
 * @returns {Record<string, Array<{name: string}>>} 区域 ID 到节点数组的映射。
 */
function classifyProxies(proxies) {
  const regionMap = { OTHER: [] };

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
 * 支持三类占位符:
 *   - @all-nodes: 展开为所有代理节点名称
 *   - @region-groups: 展开为所有已构建的区域组名称
 *   - @proxy-select/@manual-select/@auto-select: 展开为对应保留组的 name
 * @param {string} target - 占位符或普通目标名称。
 * @param {{allProxyNames: string[], regionGroupNames: string[], groupDefinitions: Record<string, {name: string}>}} context
 * @returns {string[]} 展开后的名称列表。
 */
function expandGroupTarget(target, context) {
  if (target === "@all-nodes") {
    return [...context.allProxyNames];
  }

  if (target === "@region-groups") {
    return [...context.regionGroupNames];
  }

  if (PLACEHOLDER_GROUP_IDS[target]) {
    const referencedId = PLACEHOLDER_GROUP_IDS[target];
    const referencedDefinition = context.groupDefinitions[referencedId];

    if (!referencedDefinition) {
      throw new Error(`占位符引用了未定义的策略组: ${target} -> ${referencedId}`);
    }

    return [referencedDefinition.name];
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
 * 构建完整的代理组列表: 保留组 -> 自定义组 -> 区域组 -> fallback 组。
 * @param {Array<{name: string}>} proxies - 已过滤的代理节点列表。
 * @param {Record<string, Object>} groupDefinitions - 策略组定义。
 * @returns {Array<{name: string, type: string, proxies: string[]}>} 完整的代理组列表。
 */
function buildProxyGroups(proxies, groupDefinitions) {
  const namedProxies = getNamedProxies(proxies);
  const allProxyNames = namedProxies.map((proxy) => proxy.name);
  const regionGroups = buildRegionGroups(namedProxies);
  const context = {
    allProxyNames,
    regionGroupNames: regionGroups.map((group) => group.name),
    groupDefinitions,
  };

  const groups = [];
  for (const groupId of RESERVED_GROUP_IDS) {
    groups.push(buildConfiguredGroup(groupId, groupDefinitions[groupId], context));
  }

  for (const [groupId, definition] of Object.entries(groupDefinitions)) {
    if (RESERVED_GROUP_IDS.includes(groupId) || groupId === FALLBACK_GROUP_ID) {
      continue;
    }

    groups.push(buildConfiguredGroup(groupId, definition, context));
  }

  groups.push(...regionGroups);

  groups.push(buildConfiguredGroup(FALLBACK_GROUP_ID, groupDefinitions[FALLBACK_GROUP_ID], context));
  return groups;
}

export { buildProxyGroups, getNamedProxies };

const REGION_PATTERNS = [
  { id: "HK", name: "香港", icon: "🇭🇰", pattern: /🇭🇰|香港|(?<![A-Z])HK(?![A-Z])|Hong\s*Kong/i },
  { id: "TW", name: "台湾", icon: "🇹🇼", pattern: /🇹🇼|🇨🇳.*台湾|台湾|(?<![A-Z])TW(?![A-Z])|Taiwan/i },
  { id: "JP", name: "日本", icon: "🇯🇵", pattern: /🇯🇵|日本|(?<![A-Z])JP(?![A-Z])|Japan/i },
  { id: "SG", name: "新加坡", icon: "🇸🇬", pattern: /🇸🇬|新加坡|(?<![A-Z])SG(?![A-Z])|Singapore/i },
  { id: "US", name: "美国", icon: "🇺🇸", pattern: /🇺🇸|美国|(?<![A-Z])US(?![A-Z])|United\s*States/i },
  { id: "KR", name: "韩国", icon: "🇰🇷", pattern: /🇰🇷|韩国|(?<![A-Z])KR(?![A-Z])|Korea/i },
  { id: "GB", name: "英国", icon: "🇬🇧", pattern: /🇬🇧|英国|(?<![A-Z])GB(?![A-Z])|(?<![A-Z])UK(?![A-Z])|United\s*Kingdom/i },
  { id: "DE", name: "德国", icon: "🇩🇪", pattern: /🇩🇪|德国|(?<![A-Z])DE(?![A-Z])|Germany/i },
  { id: "FR", name: "法国", icon: "🇫🇷", pattern: /🇫🇷|法国|(?<![A-Z])FR(?![A-Z])|France/i },
  { id: "CA", name: "加拿大", icon: "🇨🇦", pattern: /🇨🇦|加拿大|(?<![A-Z])CA(?![A-Z])|Canada/i },
  { id: "AU", name: "澳大利亚", icon: "🇦🇺", pattern: /🇦🇺|澳大利亚|(?<![A-Z])AU(?![A-Z])|Australia/i },
  { id: "RU", name: "俄罗斯", icon: "🇷🇺", pattern: /🇷🇺|俄罗斯|(?<![A-Z])RU(?![A-Z])|Russia/i },
  { id: "IN", name: "印度", icon: "🇮🇳", pattern: /🇮🇳|印度(?!尼)|(?<![A-Z])IN(?![A-Z])|India/i },
  { id: "MO", name: "澳门", icon: "🇲🇴", pattern: /🇲🇴|澳门|Macau|Macao/i },
  { id: "NZ", name: "新西兰", icon: "🇳🇿", pattern: /🇳🇿|新西兰|New\s*Zealand/i },
  { id: "IT", name: "意大利", icon: "🇮🇹", pattern: /🇮🇹|意大利|Italy/i },
  { id: "NL", name: "荷兰", icon: "🇳🇱", pattern: /🇳🇱|荷兰|Netherlands/i },
  { id: "PL", name: "波兰", icon: "🇵🇱", pattern: /🇵🇱|波兰|Poland/i },
  { id: "CH", name: "瑞士", icon: "🇨🇭", pattern: /🇨🇭|瑞士|Switzerland/i },
  { id: "VN", name: "越南", icon: "🇻🇳", pattern: /🇻🇳|越南|Vietnam/i },
  { id: "TH", name: "泰国", icon: "🇹🇭", pattern: /🇹🇭|泰国|Thailand/i },
  { id: "PH", name: "菲律宾", icon: "🇵🇭", pattern: /🇵🇭|菲律宾|Philippines/i },
  { id: "MY", name: "马来西亚", icon: "🇲🇾", pattern: /🇲🇾|马来|Malaysia/i },
  { id: "ID", name: "印尼", icon: "🇮🇩", pattern: /🇮🇩|印尼|印度尼西亚|Indonesia/i },
  { id: "TR", name: "土耳其", icon: "🇹🇷", pattern: /🇹🇷|土耳其|Turkey|Türkiye/i },
  { id: "AR", name: "阿根廷", icon: "🇦🇷", pattern: /🇦🇷|阿根廷|Argentina/i },
  { id: "BR", name: "巴西", icon: "🇧🇷", pattern: /🇧🇷|巴西|Brazil/i },
];

const RESERVED_GROUP_IDS = ["proxy_select", "manual_select", "auto_select"];
const FALLBACK_GROUP_ID = "fallback";
const PLACEHOLDER_GROUP_IDS = {
  "@proxy-select": "proxy_select",
  "@manual-select": "manual_select",
  "@auto-select": "auto_select",
};

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function getNamedProxies(proxies) {
  return proxies.filter(
    (proxy) => proxy && typeof proxy.name === "string" && proxy.name.trim().length > 0,
  );
}

function detectRegionId(proxyName) {
  for (const region of REGION_PATTERNS) {
    if (region.pattern.test(proxyName)) {
      return region.id;
    }
  }

  return "OTHER";
}

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
      throw new Error(`Unknown placeholder target: ${target}`);
    }

    return [referencedDefinition.name];
  }

  if (target.startsWith("@")) {
    throw new Error(`Unsupported placeholder target: ${target}`);
  }

  return [target];
}

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
    throw new Error(`Missing group name for ${groupId}`);
  }

  if (!group.type) {
    throw new Error(`Missing group type for ${groupId}`);
  }

  group.proxies = proxies;
  return group;
}

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

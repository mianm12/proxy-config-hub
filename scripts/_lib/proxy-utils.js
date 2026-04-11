"use strict";

const PROXY_SELECT_NAME = "🚀 代理选择";
const MANUAL_SELECT_NAME = "🔧 手动选择";
const AUTO_SELECT_NAME = "⚡ 自动选择";
const AUTO_TEST_URL = "http://www.gstatic.com/generate_204";

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
  { id: "BR", name: "巴西", icon: "🇧🇷", pattern: /🇧🇷|巴西|Brazil/i }
];

function detectRegionId(proxyName) {
  for (const region of REGION_PATTERNS) {
    if (region.pattern.test(proxyName)) {
      return region.id;
    }
  }

  return "OTHER";
}

function getNamedProxies(proxies) {
  return proxies.filter(
    (proxy) => proxy && typeof proxy.name === "string" && proxy.name.trim().length > 0
  );
}

function classifyProxies(proxies) {
  const regionMap = { OTHER: [] };

  for (const proxy of proxies) {
    if (!proxy || typeof proxy.name !== "string") {
      continue;
    }

    const regionId = detectRegionId(proxy.name);

    if (!regionMap[regionId]) {
      regionMap[regionId] = [];
    }

    regionMap[regionId].push(proxy);
  }

  return regionMap;
}

function buildRegionGroups(regionMap) {
  const groups = [];

  for (const region of REGION_PATTERNS) {
    const nodes = regionMap[region.id];
    if (!nodes || nodes.length === 0) {
      continue;
    }

    groups.push({
      name: `${region.icon} ${region.name}`,
      type: "select",
      proxies: nodes.map((node) => node.name)
    });
  }

  return groups;
}

function buildControlGroups(allProxyNames) {
  return [
    {
      name: MANUAL_SELECT_NAME,
      type: "select",
      proxies: [...allProxyNames]
    },
    {
      name: AUTO_SELECT_NAME,
      type: "url-test",
      url: AUTO_TEST_URL,
      interval: 300,
      tolerance: 50,
      proxies: [...allProxyNames]
    }
  ];
}

function buildProxySelect(regionGroupNames) {
  return {
    name: PROXY_SELECT_NAME,
    type: "select",
    proxies: [...regionGroupNames, MANUAL_SELECT_NAME, AUTO_SELECT_NAME, "DIRECT"]
  };
}

function buildGroupTargets(regionGroupNames, mode) {
  if (mode === "full") {
    return [
      PROXY_SELECT_NAME,
      ...regionGroupNames,
      MANUAL_SELECT_NAME,
      AUTO_SELECT_NAME,
      "DIRECT"
    ];
  }

  if (mode === "direct") {
    return ["DIRECT", PROXY_SELECT_NAME];
  }

  if (mode === "reject") {
    return ["REJECT", "DIRECT"];
  }

  throw new Error(`Unsupported group mode: ${mode}`);
}

function buildConfiguredGroups(regionGroupNames, groupDefinitions, groupIds) {
  return groupIds.map((groupId) => {
    const definition = groupDefinitions[groupId];
    if (!definition) {
      throw new Error(`Unknown group definition: ${groupId}`);
    }

    return {
      name: definition.name,
      type: "select",
      proxies: buildGroupTargets(regionGroupNames, definition.mode)
    };
  });
}

function buildProxyGroups(proxies, groupDefinitions, groupOrder) {
  const namedProxies = getNamedProxies(proxies);
  const allProxyNames = namedProxies.map((proxy) => proxy.name);
  const regionMap = classifyProxies(namedProxies);
  const regionGroups = buildRegionGroups(regionMap);
  const regionGroupNames = regionGroups.map((group) => group.name);
  const controlGroups = buildControlGroups(allProxyNames);
  const proxySelect = buildProxySelect(regionGroupNames);
  const businessGroups = buildConfiguredGroups(regionGroupNames, groupDefinitions, groupOrder.business);
  const specialGroups = buildConfiguredGroups(regionGroupNames, groupDefinitions, groupOrder.special);
  const fallbackGroup = buildConfiguredGroups(regionGroupNames, groupDefinitions, [groupOrder.fallback]);

  return [proxySelect, ...controlGroups, ...regionGroups, ...businessGroups, ...specialGroups, ...fallbackGroup];
}

if (typeof module !== "undefined") {
  module.exports = {
    AUTO_SELECT_NAME,
    AUTO_TEST_URL,
    MANUAL_SELECT_NAME,
    PROXY_SELECT_NAME,
    REGION_PATTERNS,
    buildConfiguredGroups,
    buildControlGroups,
    buildGroupTargets,
    buildProxyGroups,
    buildProxySelect,
    buildRegionGroups,
    classifyProxies,
    detectRegionId,
    getNamedProxies
  };
}

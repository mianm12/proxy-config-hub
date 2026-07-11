const SUBSCRIPTION_METADATA_PATTERNS = [
  /(?:剩余|可用)(?:流量|套餐流量)/,
  /(?:已用|使用|总)(?:流量|用量)/,
  /(?:流量|套餐)(?:剩余|已用|用量|总量|到期|过期)/,
  /(?:套餐|订阅|账户|账号)(?:到期|过期|有效期|失效)/,
  /(?:到期|过期|有效期)(?:时间|日期)?\s*[:：-]?\s*(?:\d{4}[-/.年]|永久|永不过期)/,
  /下次(?:流量)?(?:重置|更新)/,
  /\b(?:remaining|available|used|total)\s+(?:traffic|bandwidth|quota)\b/i,
  /\b(?:traffic|bandwidth|quota)\s+(?:remaining|left|used|total)\b/i,
  /\b(?:traffic|bandwidth|quota)\b\s*[:：-]?\s*\d+(?:\.\d+)?\s*[kmgtpe]i?b\b/i,
  /\b(?:expire(?:s|d)?|expiry|expiration)(?:\s+(?:date|time))?\s*[:：-]\s*(?:\d{4}[-/.]|never\b)/i,
] as const;

/** 识别订阅服务插入的流量、有效期等信息项，避免将容量单位误判为地区代码。 */
function isSubscriptionMetadataName(name: string): boolean {
  return SUBSCRIPTION_METADATA_PATTERNS.some((pattern) => pattern.test(name));
}

export { isSubscriptionMetadataName };

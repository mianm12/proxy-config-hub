import type { ProxyNode } from "../../domain/node/index.ts";
import type { MihomoProxyGroup } from "./types.ts";

const BUILTIN_TARGETS = new Set(["COMPATIBLE", "DIRECT", "DNS", "PASS", "REJECT", "REJECT-DROP"]);

function ruleTarget(rule: string): string | undefined {
  const parts = rule.split(",").map((part) => part.trim());
  if (parts.length < 2) return undefined;
  const last = parts[parts.length - 1];
  return last?.toLocaleLowerCase("en-US") === "no-resolve" ? parts[parts.length - 2] : last;
}

function validateDynamicOutput(
  proxyGroups: readonly MihomoProxyGroup[],
  providers: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
  rules: readonly string[],
  proxies: readonly ProxyNode[],
  fallbackName: string,
): void {
  const groupNames = new Set<string>();
  const proxyNames = new Set(
    proxies.flatMap((proxy) => (typeof proxy.name === "string" ? [proxy.name] : [])),
  );
  for (const group of proxyGroups) {
    if (groupNames.has(group.name)) throw new Error(`proxy-groups 存在重名组: ${group.name}`);
    groupNames.add(group.name);
    if (group.proxies.length === 0) throw new Error(`策略组节点为空: ${group.name}`);
  }

  for (const group of proxyGroups) {
    for (const member of group.proxies) {
      if (!groupNames.has(member) && !proxyNames.has(member) && !BUILTIN_TARGETS.has(member)) {
        throw new Error(`策略组 ${group.name} 引用了不存在的成员: ${member}`);
      }
    }
  }

  const providerIds = new Set(Object.keys(providers));
  rules.forEach((rule, index) => {
    if (rule.startsWith("RULE-SET,")) {
      const provider = rule.split(",")[1];
      if (provider === undefined || !providerIds.has(provider)) {
        throw new Error(`RULE-SET 引用了不存在的 provider: ${provider ?? "<missing>"}`);
      }
      const target = ruleTarget(rule);
      if (target === undefined || (!groupNames.has(target) && !BUILTIN_TARGETS.has(target))) {
        throw new Error(`RULE-SET 引用了不存在的策略组: ${target ?? "<missing>"}`);
      }
    }
    if (
      rule.startsWith("MATCH,") &&
      (index !== rules.length - 1 || rule !== `MATCH,${fallbackName}`)
    ) {
      throw new Error(`MATCH 规则必须位于末尾并指向 ${fallbackName}`);
    }
  });

  if (rules[rules.length - 1] !== `MATCH,${fallbackName}`)
    throw new Error("缺少 fallback MATCH 规则");

  for (const proxy of proxies) {
    const target = proxy["dialer-proxy"];
    if (target === undefined) continue;
    if (typeof target !== "string" || !groupNames.has(target)) {
      throw new Error(`proxy ${String(proxy.name)} 的 dialer-proxy 指向不存在的策略组`);
    }
  }
}

export { validateDynamicOutput };

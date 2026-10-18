import { z } from "zod";

import type { GroupIr, ProviderIr } from "../ir/project-ir.ts";
import type { RawProject } from "../load-raw-project.ts";
import type { DiagnosticCollector } from "./diagnostic-collector.ts";

const serversSchema = z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]);
const policySchema = z.record(z.string(), serversSchema);
const dnsReferencesSchema = z.object({
  "default-nameserver": serversSchema.optional(),
  nameserver: serversSchema.optional(),
  fallback: serversSchema.optional(),
  "proxy-server-nameserver": serversSchema.optional(),
  "direct-nameserver": serversSchema.optional(),
  "nameserver-policy": policySchema.optional(),
  "proxy-server-nameserver-policy": policySchema.optional(),
});

function validateDnsReferences(
  project: RawProject,
  groups: readonly GroupIr[],
  providers: readonly ProviderIr[],
  diagnostics: DiagnosticCollector,
): void {
  const loaded = project.runtime.find(
    ({ manifestIndex }) => project.manifest.data.runtime[manifestIndex]?.target === "dns",
  );
  if (loaded === undefined) return;
  const result = dnsReferencesSchema.safeParse(loaded.data);
  if (!result.success) {
    diagnostics.error(
      "CFG_DNS_INVALID",
      "DNS 上游必须是非空字符串或列表，策略必须是映射",
      loaded.source.locate([]),
    );
    return;
  }

  // 共享配置只绑定稳定策略组；接口名和动态节点名无法跨宿主保证存在。
  const targets = new Set(["DIRECT", "REJECT", "RULES", ...groups.map(({ name }) => name)]);
  const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
  const validateServers = (value: string | string[], location: string[]) => {
    for (const server of typeof value === "string" ? [value] : value) {
      const fragment = server.split("#")[1];
      for (const parameter of fragment?.split("&") ?? []) {
        if (
          parameter.includes("=") ||
          ["h3", "disable-ipv4", "disable-ipv6", "skip-cert-verify"].includes(parameter)
        )
          continue;
        if (!targets.has(parameter)) {
          diagnostics.error(
            "CFG_UNKNOWN_REFERENCE",
            `DNS 引用了不存在的稳定策略组: ${parameter}`,
            loaded.source.locate(location),
          );
        }
      }
    }
  };

  for (const [field, value] of Object.entries(result.data)) {
    if (value === undefined) continue;
    if (typeof value === "string" || Array.isArray(value)) {
      validateServers(value, [field]);
      continue;
    }
    for (const [key, servers] of Object.entries(value)) {
      validateServers(servers, [field, key]);
      if (!key.toLowerCase().startsWith("rule-set:")) continue;
      for (const id of key.slice("rule-set:".length).split(",")) {
        const provider = providerMap.get(id);
        if (provider === undefined || provider.config.behavior === "ipcidr") {
          diagnostics.error(
            "CFG_DNS_RULESET_INVALID",
            `DNS rule-set 必须引用已声明的 domain 或 classical provider: ${id}`,
            loaded.source.locate([field, key]),
          );
        }
      }
    }
  }
}

export { validateDnsReferences };

import type { ProviderConfigIr } from "../ir/project-ir.ts";
import type { LoadedRuntimeYaml, RawProject } from "../load-raw-project.ts";
import { dnsPolicySchema, type RawRuntimeConfig } from "../schema/raw/runtime.ts";
import type { DiagnosticCollector } from "./diagnostic-collector.ts";

const ROUTER_MANAGEMENT_ID = "router-management";

interface RouterManagementCompilationResult {
  readonly policy: Readonly<Record<string, readonly string[]>>;
  readonly provider: ProviderConfigIr;
}

function compileRouterManagement(
  project: RawProject,
  diagnostics: DiagnosticCollector,
): RouterManagementCompilationResult {
  const loaded = project.routerManagement;
  const brands = new Set<string>();
  const policy: Record<string, string[]> = {};

  loaded.data.brands.forEach((entry, brandIndex) => {
    if (brands.has(entry.brand)) {
      diagnostics.error(
        "CFG_DUPLICATE_NAME",
        `路由器品牌重复: ${entry.brand}`,
        loaded.source.locate(["brands", brandIndex, "brand"]),
      );
    }
    brands.add(entry.brand);
    const servers = entry.dns.map((address) => `${address}#DIRECT`);
    entry.domains.forEach((domain, domainIndex) => {
      if (Object.hasOwn(policy, domain)) {
        diagnostics.error(
          "CFG_ROUTER_DOMAIN_DUPLICATE",
          `路由器管理域名重复: ${domain}`,
          loaded.source.locate(["brands", brandIndex, "domains", domainIndex]),
        );
        return;
      }
      policy[domain] = servers;
    });
  });

  const references = project.modules.flatMap((module) =>
    module.data["rule-blocks"].flatMap((block) =>
      (block.providers ?? []).filter((reference) => "generated" in reference),
    ),
  );
  if (references.length !== 1) {
    diagnostics.error(
      "CFG_ROUTER_PROVIDER_REFERENCE",
      "必须在路由模块中精确引用一次 generated: router_management",
      project.manifest.source.locate(["routing", "router-management"]),
    );
  }
  if (
    !project.manifest.data.runtime.some(
      (item) => item.target === "dns" && "source" in item && item.apply === "replace",
    )
  ) {
    diagnostics.error(
      "CFG_ROUTER_DNS_TARGET",
      "路由器管理映射要求声明 apply: replace 的 dns source",
      project.manifest.source.locate(["runtime"]),
    );
  }

  return {
    policy,
    provider: {
      type: "inline",
      behavior: "domain",
      format: "yaml",
      mihomo: { payload: Object.keys(policy) },
    },
  };
}

function mergeRouterDnsPolicy(
  loaded: LoadedRuntimeYaml,
  generated: RouterManagementCompilationResult,
  diagnostics: DiagnosticCollector,
): RawRuntimeConfig {
  const value = loaded.data["nameserver-policy"];
  const result = dnsPolicySchema.safeParse(value === undefined ? {} : value);
  if (!result.success) {
    diagnostics.error(
      "CFG_DNS_INVALID",
      "nameserver-policy 必须是 DNS 上游映射",
      loaded.source.locate(["nameserver-policy"]),
    );
    return loaded.data;
  }

  for (const key of Object.keys(result.data)) {
    const normalized = key.toLowerCase().replace(/\.$/, "");
    const referencesRouters =
      normalized.startsWith("rule-set:") &&
      normalized.slice("rule-set:".length).split(",").includes(ROUTER_MANAGEMENT_ID);
    if (Object.hasOwn(generated.policy, normalized) || referencesRouters) {
      diagnostics.error(
        "CFG_ROUTER_DNS_CONFLICT",
        `管理域名 DNS 只能在品牌映射中维护，不能重复声明策略: ${key}`,
        loaded.source.locate(["nameserver-policy", key]),
      );
    }
  }

  // 只装配这个受管字段；普通 DNS 策略及其他原生 DNS 设置原样保留。
  return {
    ...loaded.data,
    "nameserver-policy": { ...generated.policy, ...result.data },
  };
}

export { compileRouterManagement, mergeRouterDnsPolicy, ROUTER_MANAGEMENT_ID };
export type { RouterManagementCompilationResult };

import type { Diagnostic } from "../../domain/diagnostics/diagnostic.ts";
import type { ProxyNode } from "../../domain/node/index.ts";
import { buildProxyGroups } from "./groups.ts";
import { buildRegionGroups } from "./regions.ts";
import { buildRouting } from "./routing.ts";
import { applyRuntimePlan } from "./runtime-plan.ts";
import { resolveTopology } from "./topology.ts";
import type { NamedProxy, OverrideProject, OverrideResult } from "./types.ts";
import { isRecord } from "./value-utils.ts";
import { validateDynamicOutput } from "./validate-output.ts";

function compileOverride(input: unknown, project: OverrideProject): OverrideResult {
  const inputConfig = isRecord(input) ? input : {};
  const sourceProxies = Array.isArray(inputConfig["proxies"])
    ? inputConfig["proxies"].filter((proxy): proxy is ProxyNode => isRecord(proxy))
    : [];
  const namedProxies: NamedProxy[] = sourceProxies.flatMap((proxy, index) => {
    const name = proxy.name;
    return typeof name === "string" && name.trim().length > 0 ? [{ proxy, index, name }] : [];
  });
  const output = applyRuntimePlan(inputConfig, project.runtimePlan);
  const diagnostics: Diagnostic[] = [];

  if (namedProxies.length === 0) {
    diagnostics.push(
      {
        code: "OVERRIDE_NO_PROXIES",
        severity: "error",
        message: "config.proxies 为空，无法生成策略组和分流规则",
      },
      {
        code: "OVERRIDE_PARTIAL_CONFIG",
        severity: "warning",
        message: "已应用 runtime preset，跳过 proxy-groups、rule-providers 和 rules 生成",
      },
    );
    return { config: output, diagnostics };
  }

  const topology = resolveTopology(sourceProxies, namedProxies, project.chains);
  diagnostics.push(...topology.diagnostics);
  const regions = buildRegionGroups(
    topology.remaining,
    project.nodeCatalog,
    project.routingRegions,
  );
  diagnostics.push(...regions.diagnostics);
  const proxyGroups = buildProxyGroups(project.groups, project.groupLayout, {
    allNodeNames: topology.remaining.map(({ name }) => name),
    chainGroups: topology.chainGroups,
    transitGroups: topology.transitGroups,
    regionGroups: regions.groups,
  });
  const routing = buildRouting(
    project.providers,
    project.rules,
    project.groups,
    project.fallbackGroup,
  );
  const fallbackName =
    project.groups.find(({ id }) => id === project.fallbackGroup)?.name ?? project.fallbackGroup;

  validateDynamicOutput(
    proxyGroups,
    routing.providers,
    routing.rules,
    topology.proxies,
    fallbackName,
  );

  output["proxies"] = topology.proxies;
  output["proxy-groups"] = proxyGroups;
  output["rule-providers"] = routing.providers;
  output["rules"] = routing.rules;
  return { config: output, diagnostics };
}

export { compileOverride };

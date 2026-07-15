import type { ChainIr, NodeSelectorIr, RegionIr, RoutingRegionIr } from "../ir/project-ir.ts";
import type { RawProject } from "../load-raw-project.ts";
import type { DiagnosticCollector } from "./diagnostic-collector.ts";

interface NodeCompilationResult {
  readonly catalog: readonly RegionIr[];
  readonly routingRegions: readonly RoutingRegionIr[];
  readonly chains: readonly ChainIr[];
}

function compileSelector(
  selector:
    | {
        readonly "any-name"?: readonly string[] | undefined;
        readonly "all-names"?: readonly string[] | undefined;
        readonly "exclude-name"?: readonly string[] | undefined;
      }
    | { readonly regex: string; readonly flags?: string | undefined },
  diagnostics: DiagnosticCollector,
  source: ReturnType<RawProject["chains"]["source"]["locate"]>,
): NodeSelectorIr {
  if ("regex" in selector) {
    try {
      new RegExp(selector.regex, selector.flags ?? "");
    } catch (error) {
      diagnostics.error("CFG_SELECTOR_REGEX_INVALID", "selector regex 无法编译", source, {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
    return { kind: "regex", pattern: selector.regex, flags: selector.flags ?? "" };
  }

  return {
    kind: "keywords",
    anyName: selector["any-name"] ?? [],
    allNames: selector["all-names"] ?? [],
    excludeNames: selector["exclude-name"] ?? [],
  };
}

function compileNodes(
  project: RawProject,
  diagnostics: DiagnosticCollector,
): NodeCompilationResult {
  const ids = new Set<string>();
  const uniqueSignals = new Map<string, string>();

  const catalog = project.nodeCatalog.data.regions.map((region, index): RegionIr => {
    const source = project.nodeCatalog.source.locate(["regions", index]);
    if (region.id === "OTHER") {
      diagnostics.error(
        "CFG_REGION_FALLBACK_INVALID",
        "OTHER 是编译器保留 fallback ID，不得在 catalog 中声明",
        source,
      );
    }
    if (ids.has(region.id)) {
      diagnostics.error("CFG_DUPLICATE_ID", `region ID 重复: ${region.id}`, source);
    }
    ids.add(region.id);

    const signals = [region.emoji, ...region.codes, ...region.names.zh, ...region.names.en];
    for (const signal of signals) {
      const normalized = signal.toLocaleLowerCase("en-US");
      const owner = uniqueSignals.get(normalized);
      if (owner !== undefined && owner !== region.id) {
        diagnostics.error(
          "CFG_REGION_SIGNAL_CONFLICT",
          `地区信号 ${signal} 同时属于 ${owner} 与 ${region.id}`,
          source,
        );
      } else {
        uniqueSignals.set(normalized, region.id);
      }
    }

    return {
      id: region.id,
      name: region.name,
      emoji: region.emoji,
      codes: region.codes,
      names: region.names,
      aliases: region.aliases,
      cities: region.cities,
    };
  });

  const routingIds = new Set<string>();
  const routingRegions = project.routingRegions.data.regions.map(
    (region, index): RoutingRegionIr => {
      const source = project.routingRegions.source.locate(["regions", index, "id"]);
      if (routingIds.has(region.id)) {
        diagnostics.error("CFG_DUPLICATE_ID", `routing region 重复: ${region.id}`, source);
      }
      routingIds.add(region.id);
      if (region.id !== "OTHER" && !ids.has(region.id)) {
        diagnostics.error(
          "CFG_UNKNOWN_REFERENCE",
          `routing region 引用了未知 catalog region: ${region.id}`,
          source,
        );
      }
      return { id: region.id, groupName: region["group-name"], type: region.type };
    },
  );
  const otherCount = routingRegions.filter(({ id }) => id === "OTHER").length;
  if (otherCount !== 1) {
    diagnostics.error(
      "CFG_REGION_FALLBACK_INVALID",
      `routing regions 必须精确包含一个 OTHER，实际 ${String(otherCount)} 个`,
      project.routingRegions.source.locate(["regions"]),
    );
  }

  const chainIds = new Set<string>();
  const endpointIds = new Set<string>();
  const chains = project.chains.data.chains.map((chain, index): ChainIr => {
    const chainSource = project.chains.source.locate(["chains", index, "id"]);
    if (chainIds.has(chain.id)) {
      diagnostics.error("CFG_DUPLICATE_ID", `chain ID 重复: ${chain.id}`, chainSource);
    }
    chainIds.add(chain.id);

    for (const [kind, endpoint] of [
      ["transit", chain.transit],
      ["landing", chain.landing],
    ] as const) {
      if (endpointIds.has(endpoint.id)) {
        diagnostics.error(
          "CFG_DUPLICATE_ID",
          `chain endpoint ID 重复: ${endpoint.id}`,
          project.chains.source.locate(["chains", index, kind, "id"]),
        );
      }
      endpointIds.add(endpoint.id);
    }

    if (chain.transit.id === chain.landing.id) {
      diagnostics.error(
        "CFG_TOPOLOGY_CYCLE",
        `chain ${chain.id} 的 landing 与 transit 不能是同一 endpoint`,
        chainSource,
      );
    }

    return {
      id: chain.id,
      transit: {
        id: chain.transit.id,
        groupName: chain.transit["group-name"],
        type: chain.transit.type,
        selector: compileSelector(
          chain.transit.selector,
          diagnostics,
          project.chains.source.locate(["chains", index, "transit", "selector"]),
        ),
        includeDirect: chain.transit["include-direct"],
      },
      landing: {
        id: chain.landing.id,
        groupName: chain.landing["group-name"],
        type: chain.landing.type,
        selector: compileSelector(
          chain.landing.selector,
          diagnostics,
          project.chains.source.locate(["chains", index, "landing", "selector"]),
        ),
      },
    };
  });

  return { catalog, routingRegions, chains };
}

export { compileNodes };
export type { NodeCompilationResult };

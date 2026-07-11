import type { RoutingRegionIr } from "../../compiler/ir/project-ir.ts";
import type { Diagnostic } from "../../domain/diagnostics/diagnostic.ts";
import { parseNodeName, type RegionDefinition } from "../../domain/node/index.ts";
import type { MihomoProxyGroup, NamedProxy } from "./types.ts";

interface RegionGroupResult {
  readonly groups: readonly MihomoProxyGroup[];
  readonly diagnostics: readonly Diagnostic[];
}

function buildRegionGroups(
  proxies: readonly NamedProxy[],
  catalog: readonly RegionDefinition[],
  routingRegions: readonly RoutingRegionIr[],
): RegionGroupResult {
  const routingIds = new Set(routingRegions.map(({ id }) => id));
  const buckets = new Map<string, string[]>();
  const diagnostics: Diagnostic[] = [];

  for (const proxy of proxies) {
    const metadata = parseNodeName(proxy.name, catalog);
    diagnostics.push(...metadata.diagnostics);
    const region = routingIds.has(metadata.region) ? metadata.region : "OTHER";
    const bucket = buckets.get(region) ?? [];
    bucket.push(proxy.name);
    buckets.set(region, bucket);
  }

  const groups = routingRegions.flatMap((region): readonly MihomoProxyGroup[] => {
    const members = buckets.get(region.id);
    return members === undefined || members.length === 0
      ? []
      : [{ name: region.groupName, type: region.type, proxies: members }];
  });

  return { groups, diagnostics };
}

export { buildRegionGroups };
export type { RegionGroupResult };

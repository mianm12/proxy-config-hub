import type { NodeCompilationResult } from "./nodes.ts";
import type { GroupCompilationResult } from "./groups.ts";
import type { DiagnosticCollector } from "./diagnostic-collector.ts";
import type { RawProject } from "../load-raw-project.ts";

function validateGeneratedGroupNames(
  project: RawProject,
  nodes: NodeCompilationResult,
  groups: GroupCompilationResult,
  diagnostics: DiagnosticCollector,
): void {
  const owners = new Map(groups.groups.map((group) => [group.name, `group ${group.id}`]));
  const generated = [
    ...nodes.routingRegions.map((region, index) => ({
      name: region.groupName,
      owner: `region ${region.id}`,
      source: project.routingRegions.source.locate(["regions", index, "group-name"]),
    })),
    ...nodes.chains.flatMap((chain, index) => [
      {
        name: chain.transit.groupName,
        owner: `chain endpoint ${chain.transit.id}`,
        source: project.chains.source.locate(["chains", index, "transit", "group-name"]),
      },
      {
        name: chain.landing.groupName,
        owner: `chain endpoint ${chain.landing.id}`,
        source: project.chains.source.locate(["chains", index, "landing", "group-name"]),
      },
    ]),
  ];

  for (const item of generated) {
    const existing = owners.get(item.name);
    if (existing !== undefined) {
      diagnostics.error(
        "CFG_DUPLICATE_NAME",
        `生成策略组名称重复: ${item.name}（${existing} / ${item.owner}）`,
        item.source,
      );
    } else {
      owners.set(item.name, item.owner);
    }
  }
}

function validateGeneratedGroupLayout(
  project: RawProject,
  nodes: NodeCompilationResult,
  groups: GroupCompilationResult,
  diagnostics: DiagnosticCollector,
): void {
  const present = new Set<string>(
    groups.layout.flatMap((item) => (item.kind === "generated" ? [item.id] : [])),
  );
  const required = [
    ...(nodes.routingRegions.length === 0 ? [] : ["region_groups"]),
    ...(nodes.chains.length === 0 ? [] : ["chain_groups", "transit_groups"]),
  ];

  for (const generated of required) {
    if (present.has(generated)) continue;
    diagnostics.error(
      "CFG_LAYOUT_MISSING_GENERATED",
      `group-layout 缺少动态生成段: ${generated}`,
      project.manifest.source.locate(["routing", "group-layout"]),
    );
  }
}

export { validateGeneratedGroupLayout, validateGeneratedGroupNames };

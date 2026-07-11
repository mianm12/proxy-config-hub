import type { GroupIr, GroupLayoutItemIr } from "../../compiler/ir/project-ir.ts";
import type { MihomoProxyGroup } from "./types.ts";

interface GroupRuntimeContext {
  readonly allNodeNames: readonly string[];
  readonly chainGroups: readonly MihomoProxyGroup[];
  readonly transitGroups: readonly MihomoProxyGroup[];
  readonly regionGroups: readonly MihomoProxyGroup[];
}

function buildConfiguredGroup(
  group: GroupIr,
  groupNames: ReadonlyMap<string, string>,
  context: GroupRuntimeContext,
): MihomoProxyGroup {
  const proxies = group.members.flatMap((member): readonly string[] => {
    if (member.kind === "group") return [groupNames.get(member.id) ?? member.id];
    if (member.kind === "pool") return context.allNodeNames;
    if (member.kind === "builtin") return [member.id];
    if (member.kind === "node") return [member.name];
    if (member.id === "chain_groups") return context.chainGroups.map(({ name }) => name);
    if (member.id === "transit_groups") return context.transitGroups.map(({ name }) => name);
    return context.regionGroups.map(({ name }) => name);
  });

  return { ...group.mihomo, name: group.name, type: group.type, proxies };
}

function buildProxyGroups(
  groups: readonly GroupIr[],
  layout: readonly GroupLayoutItemIr[],
  context: GroupRuntimeContext,
): readonly MihomoProxyGroup[] {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));

  return layout.flatMap((item): readonly MihomoProxyGroup[] => {
    if (item.kind === "generated") {
      if (item.id === "chain_groups") return context.chainGroups;
      if (item.id === "transit_groups") return context.transitGroups;
      return context.regionGroups;
    }

    const group = groupsById.get(item.id);
    return group === undefined ? [] : [buildConfiguredGroup(group, groupNames, context)];
  });
}

export { buildProxyGroups };
export type { GroupRuntimeContext };

import type { GroupIr, GroupLayoutItemIr, GroupMemberIr } from "../ir/project-ir.ts";
import type { RawProject } from "../load-raw-project.ts";
import type { DiagnosticCollector } from "./diagnostic-collector.ts";

interface GroupCompilationResult {
  readonly groups: readonly GroupIr[];
  readonly layout: readonly GroupLayoutItemIr[];
  readonly groupIds: ReadonlySet<string>;
}

const OWNED_MIHOMO_KEYS = new Set(["name", "type", "proxies", "target-group"]);

function compileMember(
  member:
    | { readonly group: string }
    | { readonly pool: "all_nodes" }
    | { readonly generated: "chain_groups" | "transit_groups" | "region_groups" }
    | { readonly builtin: string }
    | { readonly node: string },
): GroupMemberIr {
  if ("group" in member) return { kind: "group", id: member.group };
  if ("pool" in member) return { kind: "pool", id: member.pool };
  if ("generated" in member) return { kind: "generated", id: member.generated };
  if ("builtin" in member) return { kind: "builtin", id: member.builtin };
  return { kind: "node", name: member.node };
}

function validateMihomoOptions(
  options: Readonly<Record<string, unknown>>,
  diagnostics: DiagnosticCollector,
  source: ReturnType<RawProject["groupTemplates"]["source"]["locate"]>,
): void {
  for (const key of Object.keys(options)) {
    if (OWNED_MIHOMO_KEYS.has(key)) {
      diagnostics.error("CFG_MIHOMO_OWNED_FIELD", `mihomo 透传不能覆盖领域字段: ${key}`, source);
    }
  }
}

function compileGroups(
  project: RawProject,
  diagnostics: DiagnosticCollector,
): GroupCompilationResult {
  const templates = project.groupTemplates.data.templates;
  for (const [templateId, template] of Object.entries(templates)) {
    validateMihomoOptions(
      template.mihomo ?? {},
      diagnostics,
      project.groupTemplates.source.locate(["templates", templateId, "mihomo"]),
    );
  }

  const moduleIds = new Set<string>();
  const groupIds = new Set<string>();
  const groupNames = new Set<string>();
  const groupSources = new Map<
    string,
    ReturnType<RawProject["modules"][number]["source"]["locate"]>
  >();
  const groups: GroupIr[] = [];

  for (const module of project.modules) {
    if (moduleIds.has(module.data.id)) {
      diagnostics.error(
        "CFG_DUPLICATE_ID",
        `module ID 重复: ${module.data.id}`,
        module.source.locate(["id"]),
      );
    }
    moduleIds.add(module.data.id);

    module.data.groups.forEach((group, index) => {
      const source = module.source.locate(["groups", index]);
      if (groupIds.has(group.id)) {
        diagnostics.error("CFG_DUPLICATE_ID", `group ID 重复: ${group.id}`, source);
      }
      if (groupNames.has(group.name)) {
        diagnostics.error("CFG_DUPLICATE_NAME", `group name 重复: ${group.name}`, source);
      }
      groupIds.add(group.id);
      groupNames.add(group.name);
      groupSources.set(group.id, source);

      if ("template" in group) {
        const template = templates[group.template];
        if (template === undefined) {
          diagnostics.error(
            "CFG_UNKNOWN_REFERENCE",
            `group ${group.id} 引用了未知 template: ${group.template}`,
            module.source.locate(["groups", index, "template"]),
          );
          return;
        }
        validateMihomoOptions(
          group.mihomo ?? {},
          diagnostics,
          module.source.locate(["groups", index, "mihomo"]),
        );
        groups.push({
          id: group.id,
          name: group.name,
          type: template.type,
          members: template.members.map(compileMember),
          hidden: group.hidden ?? false,
          mihomo: { ...(template.mihomo ?? {}), ...(group.mihomo ?? {}) },
        });
        return;
      }

      validateMihomoOptions(
        group.mihomo ?? {},
        diagnostics,
        module.source.locate(["groups", index, "mihomo"]),
      );
      groups.push({
        id: group.id,
        name: group.name,
        type: group.type,
        members: group.members.map(compileMember),
        hidden: group.hidden ?? false,
        mihomo: group.mihomo ?? {},
      });
    });
  }

  for (const group of groups) {
    for (const member of group.members) {
      if (member.kind === "group" && !groupIds.has(member.id)) {
        diagnostics.error(
          "CFG_UNKNOWN_REFERENCE",
          `group ${group.id} 引用了未知 group: ${member.id}`,
          groupSources.get(group.id) ?? project.manifest.source.locate(),
        );
      }
    }
  }

  const layoutCounts = new Map<string, number>();
  const generatedCounts = new Map<string, number>();
  const layout: GroupLayoutItemIr[] = project.manifest.data.routing["group-layout"].map(
    (item, index) => {
      if ("group" in item) {
        layoutCounts.set(item.group, (layoutCounts.get(item.group) ?? 0) + 1);
        if (!groupIds.has(item.group)) {
          diagnostics.error(
            "CFG_UNKNOWN_REFERENCE",
            `group-layout 引用了未知 group: ${item.group}`,
            project.manifest.source.locate(["routing", "group-layout", index, "group"]),
          );
        }
        return { kind: "group", id: item.group };
      }

      generatedCounts.set(item.generated, (generatedCounts.get(item.generated) ?? 0) + 1);
      return { kind: "generated", id: item.generated };
    },
  );

  for (const group of groups) {
    const count = layoutCounts.get(group.id) ?? 0;
    if (!group.hidden && count !== 1) {
      diagnostics.error(
        count === 0 ? "CFG_LAYOUT_MISSING_GROUP" : "CFG_LAYOUT_DUPLICATE_GROUP",
        `group-layout 中 group ${group.id} 应精确出现一次，实际 ${String(count)} 次`,
        groupSources.get(group.id) ?? project.manifest.source.locate(),
      );
    }
    if (group.hidden && count > 0) {
      diagnostics.error(
        "CFG_LAYOUT_HIDDEN_GROUP",
        `hidden group 不得出现在 group-layout: ${group.id}`,
        groupSources.get(group.id) ?? project.manifest.source.locate(),
      );
    }
  }

  for (const [generated, count] of generatedCounts) {
    if (count > 1) {
      diagnostics.error(
        "CFG_LAYOUT_DUPLICATE_GENERATED",
        `group-layout generated ${generated} 最多出现一次`,
        project.manifest.source.locate(["routing", "group-layout"]),
      );
    }
  }

  return { groups, layout, groupIds };
}

export { compileGroups };
export type { GroupCompilationResult };

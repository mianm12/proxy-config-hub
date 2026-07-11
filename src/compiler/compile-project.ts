import type { ProjectIr, RenameProfileIr } from "./ir/project-ir.ts";
import { loadRawProject } from "./load-raw-project.ts";
import { DiagnosticCollector } from "./semantic/diagnostic-collector.ts";
import { compileGroups } from "./semantic/groups.ts";
import { compileNodes } from "./semantic/nodes.ts";
import { compileRouting } from "./semantic/routing.ts";
import { compileRuntimePlan } from "./semantic/runtime.ts";

function compileProject(configRoot: string): ProjectIr {
  const rawProject = loadRawProject(configRoot);
  const diagnostics = new DiagnosticCollector();
  const runtimePlan = compileRuntimePlan(rawProject, diagnostics);
  const nodes = compileNodes(rawProject, diagnostics);
  const groups = compileGroups(rawProject, diagnostics);
  const routing = compileRouting(rawProject, groups.groupIds, diagnostics);

  const renameProfiles: RenameProfileIr[] = Object.entries(
    rawProject.renameProfiles.data.profiles,
  ).map(([id, profile]) => ({
    id,
    prefix: profile.prefix,
    prefixPosition: profile["prefix-position"],
    separator: profile.separator,
    addFlag: profile["add-flag"],
    preserveMultiplier: profile["preserve-multiplier"],
    collapseSingle: profile["collapse-single"],
    preserveTags: profile["preserve-tags"],
  }));

  diagnostics.throwIfAny();

  return {
    schemaVersion: 2,
    runtimePlan,
    nodeCatalog: nodes.catalog,
    routingRegions: nodes.routingRegions,
    chains: nodes.chains,
    groups: groups.groups,
    groupLayout: groups.layout,
    providers: routing.providers,
    rules: routing.rules,
    fallbackGroup: routing.fallbackGroup,
    renameProfiles,
    deployment: {
      channel: rawProject.manifest.data.deployment.channel,
      publicBaseUrl: rawProject.manifest.data.deployment["public-base-url"],
    },
  };
}

export { compileProject };

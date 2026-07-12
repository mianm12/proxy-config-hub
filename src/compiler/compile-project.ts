import type { ProjectIr, RenameProfileIr } from "./ir/project-ir.ts";
import { loadRawProject } from "./load-raw-project.ts";
import { DiagnosticCollector } from "./semantic/diagnostic-collector.ts";
import {
  validateGeneratedGroupLayout,
  validateGeneratedGroupNames,
} from "./semantic/cross-domain.ts";
import { compileGroups } from "./semantic/groups.ts";
import { compileNodes } from "./semantic/nodes.ts";
import { compileRouting } from "./semantic/routing.ts";
import { compileRuntimePlan } from "./semantic/runtime.ts";
import { validateNoSecrets } from "./semantic/security.ts";

function compileProject(configRoot: string): ProjectIr {
  const rawProject = loadRawProject(configRoot);
  const diagnostics = new DiagnosticCollector();
  validateNoSecrets(rawProject, diagnostics);
  const runtimePlan = compileRuntimePlan(rawProject, diagnostics);
  const nodes = compileNodes(rawProject, diagnostics);
  const groups = compileGroups(rawProject, diagnostics);
  const routing = compileRouting(rawProject, groups.groups, diagnostics);
  validateGeneratedGroupNames(rawProject, nodes, groups, diagnostics);
  validateGeneratedGroupLayout(rawProject, nodes, groups, diagnostics);

  const renameDefaults = rawProject.renameProfiles.data.defaults;
  const renameProfiles: RenameProfileIr[] = Object.entries(
    rawProject.renameProfiles.data.profiles,
  ).map(([id, profile]) => ({
    id,
    fields: profile.fields ?? renameDefaults.fields,
    separator: profile.separator ?? renameDefaults.separator,
    brackets: profile.brackets ?? renameDefaults.brackets,
    subscriptionFallback:
      profile["subscription-fallback"] === undefined
        ? renameDefaults["subscription-fallback"]
        : profile["subscription-fallback"],
    extraTraits: profile["extra-traits"] ?? renameDefaults["extra-traits"],
    sequence: profile.sequence ?? renameDefaults.sequence,
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
    renameDefaultProfile: rawProject.renameProfiles.data["default-profile"],
    renameProfiles,
    deployment: {
      channel: rawProject.manifest.data.deployment.channel,
      publicBaseUrl: rawProject.manifest.data.deployment["public-base-url"],
    },
  };
}

export { compileProject };

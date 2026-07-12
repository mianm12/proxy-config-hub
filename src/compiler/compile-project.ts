import type { ProjectIr } from "./ir/project-ir.ts";
import { loadRawProject } from "./load-raw-project.ts";
import { DiagnosticCollector } from "./semantic/diagnostic-collector.ts";
import {
  validateGeneratedGroupLayout,
  validateGeneratedGroupNames,
} from "./semantic/cross-domain.ts";
import { compileGroups } from "./semantic/groups.ts";
import { compileNodes } from "./semantic/nodes.ts";
import { compileRename } from "./semantic/rename.ts";
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
  const rename = compileRename(rawProject);
  validateGeneratedGroupNames(rawProject, nodes, groups, diagnostics);
  validateGeneratedGroupLayout(rawProject, nodes, groups, diagnostics);

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
    renameDefaultProfile: rename.defaultProfile,
    renameProfiles: rename.profiles,
    deployment: {
      channel: rawProject.manifest.data.deployment.channel,
      publicBaseUrl: rawProject.manifest.data.deployment["public-base-url"],
    },
  };
}

export { compileProject };

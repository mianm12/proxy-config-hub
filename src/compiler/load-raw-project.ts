import path from "node:path";

import { parseYamlSchema } from "./schema/parse-schema.ts";
import {
  chainsSchema,
  groupTemplatesSchema,
  manifestSchema,
  nodeCatalogSchema,
  providerSourcesSchema,
  renameProfilesSchema,
  routingModuleSchema,
  routingRegionsSchema,
  runtimeConfigSchema,
  type RawChains,
  type RawGroupTemplates,
  type RawManifest,
  type RawNodeCatalog,
  type RawProviderSources,
  type RawRenameProfiles,
  type RawRoutingModule,
  type RawRoutingRegions,
  type RawRuntimeConfig,
} from "./schema/raw/index.ts";
import { loadYamlFile } from "./yaml/load-yaml.ts";
import { resolveConfigPath } from "./yaml/resolve-config-path.ts";
import type { YamlSource } from "./yaml/yaml-source.ts";

interface LoadedYaml<T> {
  readonly file: string;
  readonly source: YamlSource;
  readonly data: T;
}

interface LoadedRuntimeYaml extends LoadedYaml<RawRuntimeConfig> {
  readonly manifestIndex: number;
}

interface RawProject {
  readonly configRoot: string;
  readonly manifest: LoadedYaml<RawManifest>;
  readonly runtime: readonly LoadedRuntimeYaml[];
  readonly nodeCatalog: LoadedYaml<RawNodeCatalog>;
  readonly routingRegions: LoadedYaml<RawRoutingRegions>;
  readonly chains: LoadedYaml<RawChains>;
  readonly groupTemplates: LoadedYaml<RawGroupTemplates>;
  readonly providerSources: LoadedYaml<RawProviderSources>;
  readonly modules: readonly LoadedYaml<RawRoutingModule>[];
  readonly renameProfiles: LoadedYaml<RawRenameProfiles>;
}

function loadTypedYaml<T>(
  file: string,
  schema: Parameters<typeof parseYamlSchema<T>>[1],
): LoadedYaml<T> {
  const source = loadYamlFile(file);
  return { file, source, data: parseYamlSchema(source, schema) };
}

function loadRawProject(configRoot: string): RawProject {
  const absoluteRoot = path.resolve(configRoot);
  const manifest = loadTypedYaml(path.join(absoluteRoot, "manifest.yaml"), manifestSchema);

  const resolveManifestReference = (
    requestedPath: string,
    sourcePath: readonly (string | number)[],
  ) => resolveConfigPath(absoluteRoot, requestedPath, manifest.source.locate(sourcePath));

  const runtime = manifest.data.runtime.flatMap((item, index) => {
    if (!("source" in item)) {
      return [];
    }
    const file = resolveManifestReference(item.source, ["runtime", index, "source"]);
    return [{ ...loadTypedYaml(file, runtimeConfigSchema), manifestIndex: index }];
  });

  const nodeCatalog = loadTypedYaml(
    resolveManifestReference(manifest.data.nodes.catalog, ["nodes", "catalog"]),
    nodeCatalogSchema,
  );
  const routingRegions = loadTypedYaml(
    resolveManifestReference(manifest.data.nodes["routing-regions"], ["nodes", "routing-regions"]),
    routingRegionsSchema,
  );
  const chains = loadTypedYaml(
    resolveManifestReference(manifest.data.nodes.chains, ["nodes", "chains"]),
    chainsSchema,
  );
  const groupTemplates = loadTypedYaml(
    resolveManifestReference(manifest.data.routing["group-templates"], [
      "routing",
      "group-templates",
    ]),
    groupTemplatesSchema,
  );
  const providerSources = loadTypedYaml(
    resolveManifestReference(manifest.data.routing["provider-sources"], [
      "routing",
      "provider-sources",
    ]),
    providerSourcesSchema,
  );
  const modules = manifest.data.routing.modules.map((requestedPath, index) =>
    loadTypedYaml(
      resolveManifestReference(requestedPath, ["routing", "modules", index]),
      routingModuleSchema,
    ),
  );
  const renameProfiles = loadTypedYaml(
    resolveManifestReference(manifest.data.rename.profiles, ["rename", "profiles"]),
    renameProfilesSchema,
  );

  return {
    configRoot: absoluteRoot,
    manifest,
    runtime,
    nodeCatalog,
    routingRegions,
    chains,
    groupTemplates,
    providerSources,
    modules,
    renameProfiles,
  };
}

export { loadRawProject };
export type { LoadedRuntimeYaml, LoadedYaml, RawProject };

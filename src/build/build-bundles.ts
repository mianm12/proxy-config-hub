import fs from "node:fs";

import * as esbuild from "esbuild";

import { compileProject } from "../compiler/compile-project.ts";
import { reportBundleSize } from "./bundle-size.ts";
import {
  CONFIG_ROOT,
  DIST_V2_ROOT,
  OVERRIDE_BUNDLE,
  OVERRIDE_ENTRY,
  RENAME_BUNDLE,
  RENAME_ENTRY,
} from "./paths.ts";

const VIRTUAL_IR = "virtual:project-ir";

function runtimeDataPlugin(project: ReturnType<typeof compileProject>): esbuild.Plugin {
  const {
    runtimePlan,
    nodeCatalog,
    routingRegions,
    chains,
    groups,
    groupLayout,
    providers,
    rules,
    fallbackGroup,
  } = project;
  const overrideProject = {
    runtimePlan,
    nodeCatalog,
    routingRegions,
    chains,
    groups,
    groupLayout,
    providers,
    rules,
    fallbackGroup,
  };

  return {
    name: "project-ir-runtime-data",
    setup(build) {
      build.onResolve({ filter: /^virtual:project-ir$/ }, () => ({
        path: VIRTUAL_IR,
        namespace: "project-ir",
      }));
      build.onLoad({ filter: /.*/, namespace: "project-ir" }, () => ({
        loader: "js",
        contents:
          `export const nodeCatalog = ${JSON.stringify(project.nodeCatalog)};\n` +
          `export const renameProfiles = ${JSON.stringify(project.renameProfiles)};\n` +
          `export const overrideProject = ${JSON.stringify(overrideProject)};\n`,
      }));
    },
  };
}

async function buildBundles(): Promise<void> {
  const project = compileProject(CONFIG_ROOT);
  fs.rmSync(DIST_V2_ROOT, { force: true, recursive: true });
  fs.mkdirSync(DIST_V2_ROOT, { recursive: true });

  await esbuild.build({
    entryPoints: [OVERRIDE_ENTRY],
    outfile: OVERRIDE_BUNDLE,
    bundle: true,
    platform: "browser",
    format: "iife",
    globalName: "__proxyConfigHubOverride",
    target: "es2020",
    sourcemap: false,
    legalComments: "none",
    plugins: [runtimeDataPlugin(project)],
    footer: {
      js: `
if (typeof globalThis !== "undefined" && __proxyConfigHubOverride && typeof __proxyConfigHubOverride.main === "function") {
  globalThis.main = __proxyConfigHubOverride.main;
}
if (typeof module !== "undefined" && module && module.exports && __proxyConfigHubOverride && typeof __proxyConfigHubOverride.main === "function") {
  module.exports = { main: __proxyConfigHubOverride.main };
}
`,
    },
  });

  await esbuild.build({
    entryPoints: [RENAME_ENTRY],
    outfile: RENAME_BUNDLE,
    bundle: true,
    platform: "browser",
    format: "iife",
    globalName: "__proxyConfigHubRename",
    target: "es2020",
    sourcemap: false,
    legalComments: "none",
    plugins: [runtimeDataPlugin(project)],
    footer: {
      js: `
if (typeof globalThis !== "undefined" && __proxyConfigHubRename && typeof __proxyConfigHubRename.operator === "function") {
  globalThis.operator = __proxyConfigHubRename.operator;
}
`,
    },
  });

  reportBundleSize();
}

export { buildBundles };

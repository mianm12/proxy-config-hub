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
          `export const renameDefaultProfile = ${JSON.stringify(project.renameDefaultProfile)};\n` +
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

  // Sub-Store 在函数作用域中执行脚本；入口必须保持局部，避免污染共享的 Node 全局环境。
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
var main = __proxyConfigHubOverride.main;
if (typeof $substore === "undefined" && typeof globalThis !== "undefined" && typeof main === "function") {
  globalThis.main = main;
}
if (typeof module !== "undefined" && module && module.exports && typeof main === "function") {
  module.exports = { main };
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
var operator = __proxyConfigHubRename.operator;
if (typeof $substore === "undefined" && typeof globalThis !== "undefined" && typeof operator === "function") {
  globalThis.operator = operator;
}
`,
    },
  });

  reportBundleSize();
}

export { buildBundles };

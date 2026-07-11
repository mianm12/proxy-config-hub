import fs from "node:fs";

import * as esbuild from "esbuild";

import { compileProject } from "../compiler/compile-project.ts";
import { CONFIG_ROOT, DIST_V2_ROOT, RENAME_BUNDLE, RENAME_ENTRY } from "./paths.ts";

const VIRTUAL_IR = "virtual:project-ir";

function runtimeDataPlugin(project: ReturnType<typeof compileProject>): esbuild.Plugin {
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
          `export const renameProfiles = ${JSON.stringify(project.renameProfiles)};\n`,
      }));
    },
  };
}

async function buildV2(): Promise<void> {
  const project = compileProject(CONFIG_ROOT);
  fs.mkdirSync(DIST_V2_ROOT, { recursive: true });

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
}

export { buildV2 };

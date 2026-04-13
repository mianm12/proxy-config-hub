import * as esbuild from "esbuild";
import path from "node:path";
import { promises as fs } from "node:fs";

const REPO_ROOT = process.cwd();
const CUSTOM_ASSET_SOURCE = path.join(REPO_ROOT, "definitions", "rules", "custom");
const CUSTOM_ASSET_TARGET = path.join(REPO_ROOT, "dist", "rules", "custom");

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyDirectory(sourceDir, targetDir) {
  if (!(await pathExists(sourceDir))) {
    throw new Error(`Missing custom asset source directory: ${sourceDir}`);
  }

  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    await fs.copyFile(sourcePath, targetPath);
  }
}

await esbuild.build({
  entryPoints: ["scripts/override/main.js"],
  bundle: true,
  platform: "browser",
  format: "iife",
  globalName: "__proxyConfigHub",
  outfile: "dist/scripts/override/main.js",
  target: "es2020",
  footer: {
    js: `
if (typeof globalThis !== "undefined" && __proxyConfigHub && typeof __proxyConfigHub.main === "function") {
  globalThis.main = __proxyConfigHub.main;
}
if (typeof module !== "undefined" && module && module.exports && __proxyConfigHub && typeof __proxyConfigHub.main === "function") {
  module.exports = { main: __proxyConfigHub.main };
}
`,
  },
});

await copyDirectory(CUSTOM_ASSET_SOURCE, CUSTOM_ASSET_TARGET);

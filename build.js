import * as esbuild from "esbuild";
import { copyDirectory } from "./tools/lib/fs-helpers.js";
import { pathExists } from "./tools/lib/fs-helpers.js";
import { COPY_ASSETS } from "./tools/lib/paths.js";

/**
 * 执行 esbuild 打包并复制静态资产到 dist 目录。
 * 入口: scripts/override/main.js -> dist/scripts/override/main.js (IIFE)
 */
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

// 遍历资产映射表，将源目录复制到 dist
for (const { source, target } of COPY_ASSETS) {
  if (await pathExists(source)) {
    await copyDirectory(source, target);
  }
}

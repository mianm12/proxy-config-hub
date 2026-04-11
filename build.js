import * as esbuild from "esbuild";
import yamlPluginPkg from "esbuild-plugin-yaml";

const { yamlPlugin } = yamlPluginPkg;

await esbuild.build({
  entryPoints: ["scripts/override/main.js"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist/scripts/override/main.js",
  plugins: [yamlPlugin()],
});

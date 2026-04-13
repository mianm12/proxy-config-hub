import path from "node:path";

import {
  DEFAULT_EXAMPLE_OUTPUT_PATH,
  generateExampleConfig,
  resolveOutputTarget,
  writeExampleConfig,
} from "./lib/bundle-runtime.js";

function formatOutputTarget(outputTarget) {
  if (outputTarget === "-") {
    return "stdout";
  }

  return path.relative(process.cwd(), outputTarget) || outputTarget;
}

function main() {
  const outputTarget = resolveOutputTarget(process.argv[2]);
  const { config } = generateExampleConfig();

  writeExampleConfig(outputTarget, config);
  if (outputTarget !== "-") {
    const displayTarget =
      outputTarget === DEFAULT_EXAMPLE_OUTPUT_PATH
        ? path.relative(process.cwd(), DEFAULT_EXAMPLE_OUTPUT_PATH)
        : formatOutputTarget(outputTarget);
    console.log(`Wrote example config to ${displayTarget}`);
  }
}

main();

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BUNDLE_PATH = path.join(REPO_ROOT, "dist", "scripts", "override", "main.js");
const TEMPLATE_PATH = path.join(REPO_ROOT, "templates", "mihomo", "config-example.yaml");
const DEFAULT_EXAMPLE_OUTPUT_PATH = path.join(REPO_ROOT, "dist", "example-full-config.yaml");

function loadBundleRuntime() {
  const bundleCode = fs.readFileSync(BUNDLE_PATH, "utf8");
  const logs = [];
  const context = {
    console: {
      log: (...args) => logs.push(args.map((value) => String(value)).join(" ")),
      warn: (...args) => logs.push(args.map((value) => String(value)).join(" ")),
      error: (...args) => logs.push(args.map((value) => String(value)).join(" ")),
    },
    module: { exports: {} },
    exports: {},
  };

  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(bundleCode, context, { filename: BUNDLE_PATH });

  const main =
    typeof context.globalThis.main === "function"
      ? context.globalThis.main
      : context.module.exports.main;

  return { bundleCode, logs, main };
}

function loadTemplateConfig() {
  return yaml.load(fs.readFileSync(TEMPLATE_PATH, "utf8"));
}

function loadTemplateProxies() {
  return loadTemplateConfig().proxies;
}

function generateExampleConfig() {
  const { main, logs } = loadBundleRuntime();
  const config = main({ proxies: loadTemplateProxies() });
  return { config, logs };
}

function stringifyExampleConfig(config) {
  return yaml.dump(config, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
}

function resolveOutputTarget(rawTarget) {
  if (!rawTarget) {
    return DEFAULT_EXAMPLE_OUTPUT_PATH;
  }

  if (rawTarget === "-") {
    return "-";
  }

  return path.resolve(process.cwd(), rawTarget);
}

function writeExampleConfig(outputTarget, config) {
  const yamlText = `${stringifyExampleConfig(config)}`;

  if (outputTarget === "-") {
    process.stdout.write(yamlText);
    if (!yamlText.endsWith("\n")) {
      process.stdout.write("\n");
    }
    return;
  }

  fs.mkdirSync(path.dirname(outputTarget), { recursive: true });
  fs.writeFileSync(outputTarget, yamlText.endsWith("\n") ? yamlText : `${yamlText}\n`, "utf8");
}

export {
  BUNDLE_PATH,
  DEFAULT_EXAMPLE_OUTPUT_PATH,
  REPO_ROOT,
  generateExampleConfig,
  loadBundleRuntime,
  loadTemplateConfig,
  loadTemplateProxies,
  resolveOutputTarget,
  stringifyExampleConfig,
  writeExampleConfig,
};

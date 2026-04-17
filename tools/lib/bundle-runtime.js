import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import yaml from "js-yaml";

import {
  REPO_ROOT,
  BUNDLE_PATH,
  TEMPLATE_PATH,
  DEFAULT_EXAMPLE_OUTPUT_PATH,
} from "./paths.js";

/**
 * 加载打包产物并在沙箱环境中执行，返回 main 函数及日志。
 * @returns {{ bundleCode: string, logs: string[], main: Function }} 执行结果。
 */
function loadBundleRuntime() {
  const bundleCode = fs.readFileSync(BUNDLE_PATH, "utf8");
  const logs = [];

  // 自定义 console 用于捕获 bundle 内的日志输出而非污染宿主进程。
  const context = {
    console: {
      log: (...args) => logs.push(args.map((value) => String(value)).join(" ")),
      warn: (...args) => logs.push(args.map((value) => String(value)).join(" ")),
      error: (...args) => logs.push(args.map((value) => String(value)).join(" ")),
    },
    // 自定义 module/exports 用于兼容 IIFE 尾部的 CommonJS 导出逻辑。
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

/**
 * 读取模板配置文件并解析为对象。
 * @returns {object} 解析后的 Mihomo 配置对象。
 */
function loadTemplateConfig() {
  return yaml.load(fs.readFileSync(TEMPLATE_PATH, "utf8"));
}

/**
 * 读取模板配置中的代理列表。
 * @returns {object[]} 代理列表。
 */
function loadTemplateProxies() {
  return loadTemplateConfig().proxies;
}

/**
 * 使用模板代理执行 main 函数，生成完整示例配置。
 * @returns {{ config: object, logs: string[] }} 生成的配置对象及日志。
 */
function generateExampleConfig() {
  const { main, logs } = loadBundleRuntime();
  const config = main({ proxies: loadTemplateProxies() });
  return { config, logs };
}

/**
 * 将配置对象序列化为 YAML 字符串。
 * @param {object} config - 待序列化的配置对象。
 * @returns {string} YAML 文本。
 */
function stringifyExampleConfig(config) {
  return yaml.dump(config, {
    lineWidth: -1, // 禁用自动换行，避免长字符串（如正则 / URL）被拆行破坏语义
    noRefs: true,
    sortKeys: false,
  });
}

/**
 * 解析输出目标路径。
 * - 未指定时返回默认路径。
 * - "-" 表示标准输出。
 * - 其余值相对于当前工作目录解析为绝对路径。
 * @param {string|undefined} rawTarget - 原始目标参数。
 * @returns {string} 解析后的输出路径或 "-"。
 */
function resolveOutputTarget(rawTarget) {
  if (!rawTarget) {
    return DEFAULT_EXAMPLE_OUTPUT_PATH;
  }

  if (rawTarget === "-") {
    return "-";
  }

  return path.resolve(process.cwd(), rawTarget);
}

/**
 * 将配置写入指定目标。
 * - 目标为 "-" 时写入标准输出。
 * - 其余情况创建必要目录后写入文件。
 * @param {string} outputTarget - 输出路径或 "-"。
 * @param {object} config - 待写入的配置对象。
 */
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
  DEFAULT_EXAMPLE_OUTPUT_PATH,
  generateExampleConfig,
  loadBundleRuntime,
  loadTemplateConfig,
  loadTemplateProxies,
  resolveOutputTarget,
  stringifyExampleConfig,
  writeExampleConfig,
};

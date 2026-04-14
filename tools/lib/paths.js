import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 项目根目录，基于当前模块位置向上两级推导。
 * @type {string}
 */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * 基于项目根目录拼接路径片段。
 * @param {...string} segments - 路径片段。
 * @returns {string} 拼接后的绝对路径。
 */
function resolve(...segments) {
  return path.join(REPO_ROOT, ...segments);
}

/** definitions/ 源定义根目录 */
const DEFINITIONS_DIR = resolve("definitions");

/** scripts/config/ 生成产物根目录 */
const SCRIPTS_CONFIG_DIR = resolve("scripts", "config");

/** 打包产物路径 */
const BUNDLE_PATH = resolve("dist", "scripts", "override", "main.js");

/** 模板配置路径 */
const TEMPLATE_PATH = resolve("templates", "mihomo", "config-example.yaml");

/** 示例配置默认输出路径 */
const DEFAULT_EXAMPLE_OUTPUT_PATH = resolve("dist", "example-full-config.yaml");

/** rule-providers YAML 源文件路径 */
const RULE_PROVIDERS_YAML_PATH = resolve("definitions", "rules", "registry", "ruleProviders.yaml");

/**
 * 资产复制映射表。构建时遍历此表将源目录复制到目标目录。
 * 新增需要复制的资产只需在此处添加一行。
 * @type {Array<{source: string, target: string}>}
 */
const COPY_ASSETS = [
  { source: resolve("definitions", "rules", "custom"), target: resolve("dist", "rules", "custom") },
  { source: resolve("scripts", "sub-store"), target: resolve("dist", "scripts", "sub-store") },
];

/**
 * YAML->JS 编译管线的命名空间配置（canonical 布局）。
 * 每个命名空间定义了源目录到输出目录的映射关系。
 * @type {Array<{name: string, type: string, sourceSubdir: string, outputSubdir: string}>}
 */
const CANONICAL_NAMESPACES = [
  {
    name: "rules",
    type: "directory",
    sourceSubdir: path.join("rules", "registry"),
    outputSubdir: "rules",
  },
  {
    name: "runtime",
    type: "directory",
    sourceSubdir: "runtime",
    outputSubdir: "runtime",
  },
];

/**
 * YAML->JS 编译管线的命名空间配置（legacy 布局）。
 * @type {Array<{name: string, type: string, sourceFiles: string[], outputSubdir: string}>}
 */
const LEGACY_NAMESPACES = [
  {
    name: "rules",
    type: "files",
    sourceFiles: ["groupDefinitions.yaml", "ruleProviders.yaml"],
    outputSubdir: "rules",
  },
];

/** definitions/ 源定义目录的名称 */
const CANONICAL_ROOT_NAME = "definitions";

/** 旧版 rules/ 根目录名称 */
const LEGACY_ROOT_NAME = "rules";

/** 生成产物相对根目录的路径 */
const GENERATED_ROOT_NAME = path.join("scripts", "config");

/** canonical 布局下 definitions/ 允许的顶层子目录 */
const CANONICAL_TOP_LEVEL_NAMES = new Set(["rules", "runtime"]);

/** canonical 布局下 definitions/rules/ 允许的子目录 */
const CANONICAL_RULES_NAMES = new Set(["registry", "custom"]);

/** legacy 布局下 rules/ 允许的条目 */
const LEGACY_ALLOWED_ENTRIES = new Set(["groupDefinitions.yaml", "ruleProviders.yaml", "custom"]);

export {
  REPO_ROOT,
  resolve,
  DEFINITIONS_DIR,
  SCRIPTS_CONFIG_DIR,
  BUNDLE_PATH,
  TEMPLATE_PATH,
  DEFAULT_EXAMPLE_OUTPUT_PATH,
  RULE_PROVIDERS_YAML_PATH,
  COPY_ASSETS,
  CANONICAL_NAMESPACES,
  LEGACY_NAMESPACES,
  CANONICAL_ROOT_NAME,
  LEGACY_ROOT_NAME,
  GENERATED_ROOT_NAME,
  CANONICAL_TOP_LEVEL_NAMES,
  CANONICAL_RULES_NAMES,
  LEGACY_ALLOWED_ENTRIES,
};

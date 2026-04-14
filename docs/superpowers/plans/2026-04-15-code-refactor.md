# 代码优化重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除代码重复、将硬编码数据配置化、减少模块耦合，使新增配置无需改动 JS 代码。

**Architecture:** 渐进式重构 -- 先抽取共享模块消除重复，再将硬编码数据移入 YAML 编译管线，最后逐个重构 tools/ 和 override 脚本。每阶段完成后通过 `npm run verify` 验证功能不退化。

**Tech Stack:** Node.js ESM, esbuild, js-yaml, YAML->JS 编译管线

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `tools/lib/fs-helpers.js` | 共享文件系统工具: pathExists, listEntries, copyDirectory, copyFile |
| `tools/lib/paths.js` | 集中管理所有路径常量和资产复制映射表 |
| `scripts/override/lib/utils.js` | override 脚本共享工具: cloneData |
| `definitions/runtime/regions.yaml` | 区域匹配模式配置 (从 proxy-groups.js 提取) |
| `definitions/runtime/placeholders.yaml` | 占位符与保留组映射 (从 proxy-groups.js 提取) |

### 修改文件

| 文件 | 改动要点 |
|------|----------|
| `build.js` | 引用 fs-helpers + paths，资产复制改为遍历映射表 |
| `tools/yaml-to-js.js` | 引用 fs-helpers + paths |
| `tools/verify-main.js` | 动态发现生成产物 |
| `tools/verify-yaml-migration.js` | 动态扫描文件列表 |
| `tools/check-rule-overlap.js` | 引用 paths，改善错误处理，拆分 parseIpv6 |
| `tools/lib/bundle-runtime.js` | 引用 paths，补充注释 |
| `tools/generate-example-config.js` | 无重大改动，仅跟随 bundle-runtime 导出变化 |
| `scripts/override/lib/proxy-groups.js` | 数据层剥离，引用编译产物 |
| `scripts/override/lib/rule-assembly.js` | 导出 extractRuleTarget，补充注释和防御性检查 |
| `scripts/override/lib/runtime-preset.js` | 引用 utils.js，补充注释 |
| `scripts/override/lib/validate-output.js` | 引用 extractRuleTarget，增加 null safety |
| `scripts/override/main.js` | 无重大改动 |

### 删除文件

| 文件 | 原因 |
|------|------|
| `scripts/utils/logger.js` | 仅包装 console.log，无人使用 |

---

## Task 1: 创建共享文件系统工具 `tools/lib/fs-helpers.js`

**Files:**
- Create: `tools/lib/fs-helpers.js`

- [ ] **Step 1: 创建 fs-helpers.js**

```js
import path from "node:path";
import { promises as fs } from "node:fs";

/**
 * 检查指定路径是否存在。
 * @param {string} targetPath - 待检查的文件或目录路径。
 * @returns {Promise<boolean>} 路径存在返回 true，否则返回 false。
 */
async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 列出目录中的所有条目；目录不存在时返回空数组。
 * @param {string} dir - 目标目录路径。
 * @returns {Promise<import("node:fs").Dirent[]>} 目录条目列表。
 */
async function listEntries(dir) {
  if (!(await pathExists(dir))) {
    return [];
  }

  return fs.readdir(dir, { withFileTypes: true });
}

/**
 * 递归复制目录及其全部内容。目标目录会被先清空再写入。
 * @param {string} sourceDir - 源目录路径。
 * @param {string} targetDir - 目标目录路径。
 * @returns {Promise<void>}
 */
async function copyDirectory(sourceDir, targetDir) {
  if (!(await pathExists(sourceDir))) {
    throw new Error(`源目录不存在: ${sourceDir}`);
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

/**
 * 复制单个文件，自动创建目标目录。
 * @param {string} sourcePath - 源文件路径。
 * @param {string} targetPath - 目标文件路径。
 * @returns {Promise<void>}
 */
async function copyFile(sourcePath, targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

export { pathExists, listEntries, copyDirectory, copyFile };
```

- [ ] **Step 2: 验证文件语法**

Run: `node -e "import('./tools/lib/fs-helpers.js').then(() => console.log('OK'))"`
Expected: `OK`

- [ ] **Step 3: 提交**

```bash
git add tools/lib/fs-helpers.js
git commit -m "refactor: 抽取共享文件系统工具 fs-helpers.js"
```

---

## Task 2: 创建路径常量模块 `tools/lib/paths.js`

**Files:**
- Create: `tools/lib/paths.js`

- [ ] **Step 1: 创建 paths.js**

```js
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

/** dist/ 输出根目录 */
const DIST_DIR = resolve("dist");

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
  DIST_DIR,
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
```

- [ ] **Step 2: 验证文件语法和路径正确性**

Run: `node -e "import('./tools/lib/paths.js').then(m => { console.log('REPO_ROOT:', m.REPO_ROOT); console.log('BUNDLE_PATH:', m.BUNDLE_PATH); console.log('OK'); })"`
Expected: 输出正确的绝对路径和 `OK`

- [ ] **Step 3: 提交**

```bash
git add tools/lib/paths.js
git commit -m "refactor: 抽取路径常量模块 paths.js"
```

---

## Task 3: 创建 override 共享工具 `scripts/override/lib/utils.js`

**Files:**
- Create: `scripts/override/lib/utils.js`

- [ ] **Step 1: 创建 utils.js**

```js
/**
 * 通过 JSON 序列化/反序列化实现深拷贝。
 * 注意: 不支持 Date、RegExp、函数等非 JSON 安全类型，
 * 但本项目的配置数据均为纯 JSON 兼容对象，因此安全适用。
 * @param {unknown} value - 待拷贝的值。
 * @returns {unknown} 深拷贝后的副本。
 */
function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

export { cloneData };
```

- [ ] **Step 2: 验证文件语法**

Run: `node -e "import('./scripts/override/lib/utils.js').then(m => console.log(m.cloneData({a:1})))"`
Expected: `{ a: 1 }`

- [ ] **Step 3: 提交**

```bash
git add scripts/override/lib/utils.js
git commit -m "refactor: 抽取 override 共享工具 utils.js"
```

---

## Task 4: 重构 build.js 引用共享模块

**Files:**
- Modify: `build.js`

- [ ] **Step 1: 重写 build.js**

将 `build.js` 改为引用 `fs-helpers.js` 和 `paths.js`，删除本地 `pathExists` 和 `copyDirectory`，资产复制改为遍历 `COPY_ASSETS` 映射表:

```js
import * as esbuild from "esbuild";
import { copyDirectory } from "./tools/lib/fs-helpers.js";
import { COPY_ASSETS, resolve } from "./tools/lib/paths.js";
import { pathExists } from "./tools/lib/fs-helpers.js";

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
```

- [ ] **Step 2: 运行构建验证**

Run: `npm run build`
Expected: 无错误退出

- [ ] **Step 3: 运行完整验证**

Run: `npm run verify`
Expected: 所有验证通过

- [ ] **Step 4: 提交**

```bash
git add build.js
git commit -m "refactor: build.js 引用共享模块，资产复制改为遍历映射表"
```

---

## Task 5: 重构 yaml-to-js.js 引用共享模块

**Files:**
- Modify: `tools/yaml-to-js.js`

- [ ] **Step 1: 重写 yaml-to-js.js**

删除本地 `pathExists`、`listEntries` 及命名空间/布局常量定义，改为引用 `fs-helpers.js` 和 `paths.js`:

```js
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

import { pathExists, listEntries } from "./lib/fs-helpers.js";
import {
  CANONICAL_NAMESPACES,
  LEGACY_NAMESPACES,
  CANONICAL_ROOT_NAME,
  LEGACY_ROOT_NAME,
  GENERATED_ROOT_NAME,
  CANONICAL_TOP_LEVEL_NAMES,
  CANONICAL_RULES_NAMES,
  LEGACY_ALLOWED_ENTRIES,
} from "./lib/paths.js";

/**
 * 递归遍历目录，收集所有 YAML 文件路径。
 * 遇到非 YAML 文件会抛出错误，确保命名空间目录内不含意外文件。
 * @param {string} dir - 待遍历的目录路径。
 * @returns {Promise<string[]>} YAML 文件绝对路径列表。
 */
async function walkYamlFiles(dir) {
  const entries = await listEntries(dir);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkYamlFiles(fullPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!/\.(ya?ml)$/i.test(entry.name)) {
      throw new Error(`YAML 命名空间下存在不支持的文件: ${fullPath}`);
    }

    files.push(fullPath);
  }

  return files;
}

/**
 * 校验 canonical 布局 (definitions/) 的目录结构合法性。
 * @param {string} rootDir - definitions/ 目录的绝对路径。
 * @returns {Promise<void>}
 */
async function validateCanonicalLayout(rootDir) {
  const rootEntries = await listEntries(rootDir);

  for (const entry of rootEntries) {
    if (!CANONICAL_TOP_LEVEL_NAMES.has(entry.name)) {
      throw new Error(`definitions/ 下存在不支持的条目: ${entry.name}`);
    }
  }

  const rulesDir = path.join(rootDir, "rules");
  const rulesEntries = await listEntries(rulesDir);

  for (const entry of rulesEntries) {
    if (!CANONICAL_RULES_NAMES.has(entry.name)) {
      throw new Error(`definitions/rules/ 下存在不支持的条目: ${entry.name}`);
    }
  }
}

/**
 * 校验 legacy 布局 (rules/) 的目录结构合法性。
 * @param {string} rootDir - rules/ 目录的绝对路径。
 * @returns {Promise<void>}
 */
async function validateLegacyLayout(rootDir) {
  const rootEntries = await listEntries(rootDir);

  for (const entry of rootEntries) {
    if (!LEGACY_ALLOWED_ENTRIES.has(entry.name)) {
      throw new Error(`legacy rules/ 下存在不支持的条目: ${entry.name}`);
    }
  }
}

/**
 * 检测当前工作目录使用的源树布局（canonical 或 legacy），并校验其结构。
 * definitions/ 和 rules/ 不可同时存在。
 * @param {string} cwd - 当前工作目录。
 * @returns {Promise<{kind: string, rootDir: string, namespaces: Array, warning?: string}>}
 */
async function resolveSourceTree(cwd) {
  const canonicalRoot = path.join(cwd, CANONICAL_ROOT_NAME);
  const legacyRoot = path.join(cwd, LEGACY_ROOT_NAME);
  const canonicalExists = await pathExists(canonicalRoot);
  const legacyExists = await pathExists(legacyRoot);

  if (canonicalExists && legacyExists) {
    throw new Error("definitions/ 和 rules/ 不可同时存在");
  }

  if (canonicalExists) {
    await validateCanonicalLayout(canonicalRoot);
    return {
      kind: "canonical",
      rootDir: canonicalRoot,
      namespaces: CANONICAL_NAMESPACES,
    };
  }

  if (legacyExists) {
    await validateLegacyLayout(legacyRoot);
    return {
      kind: "legacy",
      rootDir: legacyRoot,
      namespaces: LEGACY_NAMESPACES,
      warning:
        "Legacy rules/ source tree is deprecated. Migrate YAML files to definitions/ as soon as possible.",
    };
  }

  throw new Error("未找到 definitions/ 或 rules/ 源定义目录");
}

/**
 * 收集指定命名空间下所有待转换的 YAML 文件。
 * @param {string} rootDir - 源树根目录。
 * @param {{type: string, sourceFiles?: string[], sourceSubdir?: string}} namespace - 命名空间配置。
 * @returns {Promise<{files: string[], inputRoot: string}>}
 */
async function collectNamespaceFiles(rootDir, namespace) {
  if (namespace.type === "files") {
    const files = [];

    for (const relativePath of namespace.sourceFiles) {
      const fullPath = path.join(rootDir, relativePath);
      if (!(await pathExists(fullPath))) {
        throw new Error(`缺少必需的 YAML 文件: ${fullPath}`);
      }

      files.push(fullPath);
    }

    return { files, inputRoot: rootDir };
  }

  const namespaceRoot = path.join(rootDir, namespace.sourceSubdir);

  if (!(await pathExists(namespaceRoot))) {
    throw new Error(`缺少必需的命名空间目录: ${namespaceRoot}`);
  }

  return {
    files: await walkYamlFiles(namespaceRoot),
    inputRoot: namespaceRoot,
  };
}

/**
 * 将单个 YAML 文件转换为 JS export default 模块。
 * @param {string} inputFile - 输入 YAML 文件路径。
 * @param {string} inputRoot - 输入根目录（用于计算相对路径）。
 * @param {string} outputRoot - 输出根目录。
 * @returns {Promise<{inputFile: string, outputFile: string}>}
 */
async function convertOne(inputFile, inputRoot, outputRoot) {
  const relativePath = path.relative(inputRoot, inputFile);
  const outputFile = path.join(outputRoot, relativePath.replace(/\.(ya?ml)$/i, ".js"));
  const text = await fs.readFile(inputFile, "utf8");
  const data = yaml.load(text);

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `export default ${JSON.stringify(data, null, 2)};\n`, "utf8");

  return { inputFile, outputFile };
}

/**
 * 主编译函数: 检测源树布局，按命名空间将 YAML 转换为 JS 模块。
 * @param {Object} options - 编译选项。
 * @param {string} [options.cwd=process.cwd()] - 工作目录。
 * @param {Function} [options.log=console.log] - 日志输出函数。
 * @param {string[]} [options.requiredNamespaces] - 需要编译的命名空间列表。
 * @returns {Promise<{sourceTree: string, results: Array}>}
 */
async function buildYamlModules({
  cwd = process.cwd(),
  log = console.log,
  requiredNamespaces,
} = {}) {
  const activeTree = await resolveSourceTree(cwd);
  const required = new Set(
    requiredNamespaces ?? (activeTree.kind === "canonical" ? ["rules", "runtime"] : ["rules"]),
  );

  if (activeTree.warning) {
    log(activeTree.warning);
  }

  await Promise.all(
    ["rules", "runtime"].map((namespaceName) =>
      fs.rm(path.join(cwd, GENERATED_ROOT_NAME, namespaceName), {
        recursive: true,
        force: true,
      }),
    ),
  );

  const results = [];
  const namespaceMap = new Map(activeTree.namespaces.map((namespace) => [namespace.name, namespace]));

  for (const namespaceName of required) {
    if (!namespaceMap.has(namespaceName)) {
      throw new Error(`缺少已配置的命名空间: ${namespaceName}`);
    }
  }

  for (const namespace of activeTree.namespaces) {
    if (!required.has(namespace.name)) {
      continue;
    }

    const { files, inputRoot } = await collectNamespaceFiles(activeTree.rootDir, namespace);
    const outputRoot = path.join(cwd, GENERATED_ROOT_NAME, namespace.outputSubdir);

    for (const inputFile of files) {
      const result = await convertOne(inputFile, inputRoot, outputRoot);
      results.push(result);
      log(`Converted: ${path.relative(cwd, result.inputFile)} -> ${path.relative(cwd, result.outputFile)}`);
    }
  }

  if (results.length === 0) {
    throw new Error("未生成任何 YAML 模块");
  }

  log(`Done. Converted ${results.length} file(s).`);
  return {
    sourceTree: activeTree.kind,
    results,
  };
}

const isCli =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  buildYamlModules().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { buildYamlModules };
```

- [ ] **Step 2: 运行 YAML 编译**

Run: `npm run rules:build`
Expected: 无错误，输出 Converted 行和 Done

- [ ] **Step 3: 运行完整验证**

Run: `npm run verify`
Expected: 所有验证通过

- [ ] **Step 4: 提交**

```bash
git add tools/yaml-to-js.js
git commit -m "refactor: yaml-to-js.js 引用共享模块，消除重复函数和常量"
```

---

## Task 6: 重构 bundle-runtime.js 引用路径常量

**Files:**
- Modify: `tools/lib/bundle-runtime.js`

- [ ] **Step 1: 重写 bundle-runtime.js**

删除本地 `REPO_ROOT` 和路径常量定义，改为引用 `paths.js`:

```js
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
 * 在隔离 VM 上下文中加载并执行打包产物，返回 main 函数。
 * 自定义 console 用于捕获 bundle 内的日志输出而非污染宿主进程。
 * 自定义 module/exports 用于兼容 IIFE 尾部的 CommonJS 导出逻辑。
 * @returns {{bundleCode: string, logs: string[], main: Function}}
 */
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

/**
 * 加载模板配置文件并解析为 JS 对象。
 * @returns {Record<string, unknown>} 解析后的模板配置。
 */
function loadTemplateConfig() {
  return yaml.load(fs.readFileSync(TEMPLATE_PATH, "utf8"));
}

/**
 * 从模板配置中提取 proxies 列表。
 * @returns {Array<{name: string}>} 代理节点列表。
 */
function loadTemplateProxies() {
  return loadTemplateConfig().proxies;
}

/**
 * 使用模板代理节点执行 bundle，生成完整示例配置。
 * @returns {{config: Record<string, unknown>, logs: string[]}}
 */
function generateExampleConfig() {
  const { main, logs } = loadBundleRuntime();
  const config = main({ proxies: loadTemplateProxies() });
  return { config, logs };
}

/**
 * 将配置对象序列化为 YAML 字符串。
 * lineWidth: -1 表示不自动换行，保持单行输出。
 * @param {Record<string, unknown>} config - 配置对象。
 * @returns {string} YAML 文本。
 */
function stringifyExampleConfig(config) {
  return yaml.dump(config, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
}

/**
 * 解析输出目标路径。"-" 表示 stdout，空值使用默认路径。
 * @param {string} [rawTarget] - 原始目标参数。
 * @returns {string} 解析后的目标路径或 "-"。
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
 * 将示例配置写入文件或 stdout。
 * @param {string} outputTarget - 输出目标，"-" 表示 stdout。
 * @param {Record<string, unknown>} config - 配置对象。
 * @returns {void}
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
```

- [ ] **Step 2: 运行验证**

Run: `npm run verify`
Expected: 所有验证通过

- [ ] **Step 3: 提交**

```bash
git add tools/lib/bundle-runtime.js
git commit -m "refactor: bundle-runtime.js 引用路径常量模块，补充函数注释"
```

---

## Task 7: 重构 verify-main.js 动态发现生成产物

**Files:**
- Modify: `tools/verify-main.js`

- [ ] **Step 1: 修改 assertGeneratedFiles 函数**

将 `verify-main.js` 中手动列出 9 个文件路径的 `assertGeneratedFiles` 改为动态扫描 `definitions/` 推导期望产物。需要修改的是第 141-162 行:

将 import 部分改为:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import baseConfig from "../scripts/config/runtime/base.js";
import dnsConfig from "../scripts/config/runtime/dns.js";
import geodataConfig from "../scripts/config/runtime/geodata.js";
import profileConfig from "../scripts/config/runtime/profile.js";
import groupDefinitionsConfig from "../scripts/config/rules/groupDefinitions.js";
import inlineRulesConfig from "../scripts/config/rules/inlineRules.js";
import ruleProvidersConfig from "../scripts/config/rules/ruleProviders.js";
import snifferConfig from "../scripts/config/runtime/sniffer.js";
import tunConfig from "../scripts/config/runtime/tun.js";
import { assembleRuleSet } from "../scripts/override/lib/rule-assembly.js";
import {
  REPO_ROOT,
  loadBundleRuntime,
  loadTemplateProxies,
  stringifyExampleConfig,
} from "./lib/bundle-runtime.js";
import {
  DEFINITIONS_DIR,
  SCRIPTS_CONFIG_DIR,
  CANONICAL_NAMESPACES,
} from "./lib/paths.js";
```

将 `assertGeneratedFiles` 函数改为:

```js
/**
 * 校验 scripts/config 生成产物是否完整存在，且不会错误包含 custom 模板产物。
 * 通过扫描 definitions/ 源目录动态推导期望产物列表，新增 YAML 定义文件后无需修改此函数。
 * @returns {void}
 */
function assertGeneratedFiles() {
  for (const namespace of CANONICAL_NAMESPACES) {
    const sourceDir = path.join(DEFINITIONS_DIR, namespace.sourceSubdir);
    const outputDir = path.join(SCRIPTS_CONFIG_DIR, namespace.outputSubdir);

    if (!fs.existsSync(sourceDir)) {
      throw new Error(`缺少源定义目录: ${path.relative(REPO_ROOT, sourceDir)}`);
    }

    const yamlFiles = fs.readdirSync(sourceDir).filter((name) => /\.(ya?ml)$/i.test(name));

    for (const yamlFile of yamlFiles) {
      const expectedJs = yamlFile.replace(/\.(ya?ml)$/i, ".js");
      const expectedPath = path.join(outputDir, expectedJs);
      assert.ok(
        fs.existsSync(expectedPath),
        `缺少生成产物文件: ${path.relative(REPO_ROOT, expectedPath)}`,
      );
    }
  }

  assert.ok(
    !fs.existsSync(path.join(SCRIPTS_CONFIG_DIR, "rules", "custom", "_template.js")),
    "custom 模板不得被转换到 scripts/config",
  );
}
```

其余函数保持不变。

- [ ] **Step 2: 运行验证**

Run: `npm run verify`
Expected: 所有验证通过

- [ ] **Step 3: 提交**

```bash
git add tools/verify-main.js
git commit -m "refactor: verify-main.js 动态发现生成产物，引用路径常量"
```

---

## Task 8: 重构 verify-yaml-migration.js 消除文件列表重复

**Files:**
- Modify: `tools/verify-yaml-migration.js`

- [ ] **Step 1: 重写 verify-yaml-migration.js**

消除三次重复的文件列表，改为运行时扫描目录:

```js
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { promises as fsp } from "node:fs";

import { buildYamlModules } from "./yaml-to-js.js";
import { copyFile } from "./lib/fs-helpers.js";
import {
  DEFINITIONS_DIR,
  SCRIPTS_CONFIG_DIR,
  CANONICAL_NAMESPACES,
} from "./lib/paths.js";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/**
 * 创建带指定前缀的临时工作目录。
 * @param {string} prefix - 目录名前缀。
 * @returns {Promise<string>} 临时目录绝对路径。
 */
async function createTempWorkspace(prefix) {
  return fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

/**
 * 读取工作目录下指定相对路径的文件内容。
 * @param {string} workspaceRoot - 工作目录根路径。
 * @param {string} relativePath - 相对文件路径。
 * @returns {Promise<string>} 文件内容。
 */
async function readGeneratedFile(workspaceRoot, relativePath) {
  return fsp.readFile(path.join(workspaceRoot, relativePath), "utf8");
}

/**
 * 扫描 definitions/ 下指定命名空间的所有 YAML 文件名。
 * @param {string} sourceSubdir - 命名空间源子目录（相对于 definitions/）。
 * @returns {string[]} YAML 文件名列表。
 */
function scanDefinitionFiles(sourceSubdir) {
  const sourceDir = path.join(DEFINITIONS_DIR, sourceSubdir);
  return fs.readdirSync(sourceDir).filter((name) => /\.(ya?ml)$/i.test(name));
}

/**
 * 创建 canonical 布局的临时工作目录，复制 definitions/ 下所有 YAML 源文件。
 * @returns {Promise<string>} 工作目录路径。
 */
async function setupCanonicalWorkspace() {
  const workspaceRoot = await createTempWorkspace("proxy-config-hub-definitions-");

  for (const namespace of CANONICAL_NAMESPACES) {
    const yamlFiles = scanDefinitionFiles(namespace.sourceSubdir);
    for (const fileName of yamlFiles) {
      const relativePath = path.join(namespace.sourceSubdir, fileName);
      await copyFile(
        path.join(DEFINITIONS_DIR, relativePath),
        path.join(workspaceRoot, "definitions", relativePath),
      );
    }
  }

  return workspaceRoot;
}

/**
 * 校验 canonical 布局转换产物与仓库现有产物一致。
 * @param {string} workspaceRoot - 临时工作目录路径。
 * @param {string} outputSubdir - 输出子目录（如 "runtime"）。
 * @param {string} sourceSubdir - 源子目录（用于推导期望文件列表）。
 * @returns {Promise<void>}
 */
async function assertCanonicalOutputs(workspaceRoot, outputSubdir, sourceSubdir) {
  const yamlFiles = scanDefinitionFiles(sourceSubdir);

  for (const yamlFile of yamlFiles) {
    const jsFile = yamlFile.replace(/\.(ya?ml)$/i, ".js");
    const relativePath = path.join("scripts", "config", outputSubdir, jsFile);
    assert.equal(
      await readGeneratedFile(workspaceRoot, relativePath),
      await readGeneratedFile(REPO_ROOT, relativePath),
      `canonical ${outputSubdir} 转换产物应与仓库输出一致: ${jsFile}`,
    );
  }
}

/**
 * 创建 legacy 布局的临时工作目录。
 * @returns {Promise<string>} 工作目录路径。
 */
async function setupLegacyWorkspace() {
  const workspaceRoot = await createTempWorkspace("proxy-config-hub-rules-");
  const registryDir = path.join(DEFINITIONS_DIR, "rules", "registry");

  // legacy 布局仅包含 groupDefinitions.yaml 和 ruleProviders.yaml
  await copyFile(
    path.join(registryDir, "groupDefinitions.yaml"),
    path.join(workspaceRoot, "rules", "groupDefinitions.yaml"),
  );
  await copyFile(
    path.join(registryDir, "ruleProviders.yaml"),
    path.join(workspaceRoot, "rules", "ruleProviders.yaml"),
  );

  return workspaceRoot;
}

/**
 * 校验 definitions/ 和 rules/ 同时存在时编译会报错。
 * @returns {Promise<void>}
 */
async function assertMixedRootsFail() {
  const workspaceRoot = await createTempWorkspace("proxy-config-hub-mixed-");
  const registryDir = path.join(DEFINITIONS_DIR, "rules", "registry");

  try {
    // 同时创建 canonical 和 legacy 布局
    await copyFile(
      path.join(registryDir, "groupDefinitions.yaml"),
      path.join(workspaceRoot, "definitions", "rules", "registry", "groupDefinitions.yaml"),
    );
    await copyFile(
      path.join(registryDir, "ruleProviders.yaml"),
      path.join(workspaceRoot, "definitions", "rules", "registry", "ruleProviders.yaml"),
    );
    await copyFile(
      path.join(registryDir, "groupDefinitions.yaml"),
      path.join(workspaceRoot, "rules", "groupDefinitions.yaml"),
    );
    await copyFile(
      path.join(registryDir, "ruleProviders.yaml"),
      path.join(workspaceRoot, "rules", "ruleProviders.yaml"),
    );

    let didThrow = false;
    try {
      await buildYamlModules({ cwd: workspaceRoot, requiredNamespaces: ["rules"], log: () => {} });
    } catch (error) {
      didThrow = /cannot coexist|不可同时存在/.test(error.message);
    }

    assert.equal(didThrow, true, "混合 legacy/canonical 布局应报错");
  } finally {
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

/**
 * 执行完整的 YAML 迁移兼容性验证。
 * @returns {Promise<void>}
 */
async function main() {
  const canonicalWorkspace = await setupCanonicalWorkspace();
  const legacyWorkspace = await setupLegacyWorkspace();

  try {
    await buildYamlModules({ cwd: canonicalWorkspace, requiredNamespaces: ["rules", "runtime"], log: () => {} });
    await buildYamlModules({ cwd: legacyWorkspace, requiredNamespaces: ["rules"], log: () => {} });

    const canonicalGroupDefinitions = await readGeneratedFile(
      canonicalWorkspace,
      path.join("scripts", "config", "rules", "groupDefinitions.js"),
    );
    const legacyGroupDefinitions = await readGeneratedFile(
      legacyWorkspace,
      path.join("scripts", "config", "rules", "groupDefinitions.js"),
    );
    const canonicalRuleProviders = await readGeneratedFile(
      canonicalWorkspace,
      path.join("scripts", "config", "rules", "ruleProviders.js"),
    );
    const legacyRuleProviders = await readGeneratedFile(
      legacyWorkspace,
      path.join("scripts", "config", "rules", "ruleProviders.js"),
    );

    assert.equal(
      canonicalGroupDefinitions,
      legacyGroupDefinitions,
      "legacy rules/ 转换产物应与 canonical definitions 输出一致",
    );
    assert.equal(
      canonicalRuleProviders,
      legacyRuleProviders,
      "legacy rules/ 转换产物应与 canonical definitions 输出一致",
    );
    assert.equal(
      false,
      await fsp
        .access(path.join(canonicalWorkspace, "scripts", "config", "rules", "custom", "_template.js"))
        .then(() => true)
        .catch(() => false),
      "custom 模板不得被转换到 scripts/config",
    );

    // 逐命名空间校验 canonical 产物
    for (const namespace of CANONICAL_NAMESPACES) {
      await assertCanonicalOutputs(canonicalWorkspace, namespace.outputSubdir, namespace.sourceSubdir);
    }

    await assertMixedRootsFail();
    console.log("YAML migration verification passed");
  } finally {
    await Promise.all([
      fsp.rm(canonicalWorkspace, { recursive: true, force: true }),
      fsp.rm(legacyWorkspace, { recursive: true, force: true }),
    ]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: 运行验证**

Run: `npm run verify`
Expected: 所有验证通过（包括 YAML migration verification passed）

- [ ] **Step 3: 提交**

```bash
git add tools/verify-yaml-migration.js
git commit -m "refactor: verify-yaml-migration.js 动态扫描文件列表，消除重复"
```

---

## Task 9: 重构 check-rule-overlap.js

**Files:**
- Modify: `tools/check-rule-overlap.js`

- [ ] **Step 1: 引用 paths.js 并改善错误处理**

修改 import 区域和 `loadRuleProviders`，引用 `RULE_PROVIDERS_YAML_PATH`:

将文件开头的 import 和常量替换为:

```js
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

import { RULE_PROVIDERS_YAML_PATH } from "./lib/paths.js";
```

删除原来的:
```js
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RULE_PROVIDERS_PATH = path.join(REPO_ROOT, "definitions", "rules", "registry", "ruleProviders.yaml");
```

将 `loadRuleProviders` 中的 `RULE_PROVIDERS_PATH` 替换为 `RULE_PROVIDERS_YAML_PATH`。

- [ ] **Step 2: 拆分 parseIpv6 为更小的函数**

将当前的 `parseIpv6`（第 143-183 行）拆分:

```js
/**
 * 将 IPv6 地址的 :: 缩写展开为完整的 8 段格式。
 * @param {string} address - IPv6 地址字符串。
 * @returns {string[]} 8 个十六进制段的数组。
 */
function expandIpv6Segments(address) {
  const segments = address.split("::");

  if (segments.length > 2) {
    throw new Error(`IPv6 地址格式无效（多个 ::）: ${address}`);
  }

  const left = segments[0] ? segments[0].split(":").filter(Boolean) : [];
  const right = segments[1] ? segments[1].split(":").filter(Boolean) : [];

  if (segments.length === 1 && left.length !== 8) {
    throw new Error(`IPv6 地址格式无效（段数不为 8）: ${address}`);
  }

  if (left.length + right.length > 8) {
    throw new Error(`IPv6 地址格式无效（总段数超过 8）: ${address}`);
  }

  const middle = Array(8 - left.length - right.length).fill("0");
  return [...left, ...middle, ...right];
}

/**
 * 将 8 个十六进制段转换为 128 位 BigInt。
 * @param {string[]} parts - 8 个十六进制段。
 * @param {string} address - 原始地址（用于错误信息）。
 * @returns {bigint} 128 位整数表示。
 */
function ipv6SegmentsToBigInt(parts, address) {
  if (parts.length !== 8) {
    throw new Error(`IPv6 地址格式无效（展开后段数不为 8）: ${address}`);
  }

  return parts.reduce((result, part) => {
    const value = Number.parseInt(part || "0", 16);

    if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
      throw new Error(`IPv6 地址段值无效: ${address}`);
    }

    return (result << 16n) + BigInt(value);
  }, 0n);
}

/**
 * 解析 IPv6 地址为 128 位 BigInt，支持 :: 缩写和嵌入式 IPv4。
 * @param {string} address - IPv6 地址字符串。
 * @returns {bigint} 128 位整数表示。
 */
function parseIpv6(address) {
  let normalized = address;

  if (normalized.includes(".")) {
    normalized = expandEmbeddedIpv4(normalized);
  }

  const parts = expandIpv6Segments(normalized);
  return ipv6SegmentsToBigInt(parts, address);
}
```

- [ ] **Step 3: 为 main 添加顶层 try-catch**

```js
async function main(options = {}) {
  const { summaryOnly = false } = options;
  const providers = loadRuleProviders();
  const fetchedProviders = await Promise.all(providers.map((provider) => fetchRuleSet(provider)));
  const report = summarizeOverlap(fetchedProviders);
  printReport(report, { summaryOnly });
  return report;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const summaryOnly = process.argv.includes("--summary");
  main({ summaryOnly }).catch((error) => {
    console.error("规则重叠检查失败:", error.message || error);
    process.exit(1);
  });
}
```

- [ ] **Step 4: 验证语法**

Run: `node -e "import('./tools/check-rule-overlap.js').then(() => console.log('OK'))"`
Expected: `OK`（不会实际执行 main，因为非 CLI 模式）

- [ ] **Step 5: 提交**

```bash
git add tools/check-rule-overlap.js
git commit -m "refactor: check-rule-overlap.js 引用路径常量，拆分 parseIpv6，改善错误处理"
```

---

## Task 10: 新增 regions.yaml 和 placeholders.yaml

**Files:**
- Create: `definitions/runtime/regions.yaml`
- Create: `definitions/runtime/placeholders.yaml`

- [ ] **Step 1: 创建 regions.yaml**

从 `proxy-groups.js` 第 1-29 行提取 29 条 REGION_PATTERNS，转为 YAML。注意: pattern 中的正则需要保留原始转义，flags 统一为 "i":

```yaml
- id: HK
  name: 香港
  icon: "\U0001F1ED\U0001F1F0"
  pattern: "\U0001F1ED\U0001F1F0|香港|(?<![A-Z])HK(?![A-Z])|Hong\\s*Kong"
  flags: i
- id: TW
  name: 台湾
  icon: "\U0001F1F9\U0001F1FC"
  pattern: "\U0001F1F9\U0001F1FC|\U0001F1E8\U0001F1F3.*台湾|台湾|(?<![A-Z])TW(?![A-Z])|Taiwan"
  flags: i
- id: JP
  name: 日本
  icon: "\U0001F1EF\U0001F1F5"
  pattern: "\U0001F1EF\U0001F1F5|日本|(?<![A-Z])JP(?![A-Z])|Japan"
  flags: i
- id: SG
  name: 新加坡
  icon: "\U0001F1F8\U0001F1EC"
  pattern: "\U0001F1F8\U0001F1EC|新加坡|(?<![A-Z])SG(?![A-Z])|Singapore"
  flags: i
- id: US
  name: 美国
  icon: "\U0001F1FA\U0001F1F8"
  pattern: "\U0001F1FA\U0001F1F8|美国|(?<![A-Z])US(?![A-Z])|United\\s*States"
  flags: i
- id: KR
  name: 韩国
  icon: "\U0001F1F0\U0001F1F7"
  pattern: "\U0001F1F0\U0001F1F7|韩国|(?<![A-Z])KR(?![A-Z])|Korea"
  flags: i
- id: GB
  name: 英国
  icon: "\U0001F1EC\U0001F1E7"
  pattern: "\U0001F1EC\U0001F1E7|英国|(?<![A-Z])GB(?![A-Z])|(?<![A-Z])UK(?![A-Z])|United\\s*Kingdom"
  flags: i
- id: DE
  name: 德国
  icon: "\U0001F1E9\U0001F1EA"
  pattern: "\U0001F1E9\U0001F1EA|德国|(?<![A-Z])DE(?![A-Z])|Germany"
  flags: i
- id: FR
  name: 法国
  icon: "\U0001F1EB\U0001F1F7"
  pattern: "\U0001F1EB\U0001F1F7|法国|(?<![A-Z])FR(?![A-Z])|France"
  flags: i
- id: CA
  name: 加拿大
  icon: "\U0001F1E8\U0001F1E6"
  pattern: "\U0001F1E8\U0001F1E6|加拿大|(?<![A-Z])CA(?![A-Z])|Canada"
  flags: i
- id: AU
  name: 澳大利亚
  icon: "\U0001F1E6\U0001F1FA"
  pattern: "\U0001F1E6\U0001F1FA|澳大利亚|(?<![A-Z])AU(?![A-Z])|Australia"
  flags: i
- id: RU
  name: 俄罗斯
  icon: "\U0001F1F7\U0001F1FA"
  pattern: "\U0001F1F7\U0001F1FA|俄罗斯|(?<![A-Z])RU(?![A-Z])|Russia"
  flags: i
- id: IN
  name: 印度
  icon: "\U0001F1EE\U0001F1F3"
  pattern: "\U0001F1EE\U0001F1F3|印度(?!尼)|(?<![A-Z])IN(?![A-Z])|India"
  flags: i
- id: MO
  name: 澳门
  icon: "\U0001F1F2\U0001F1F4"
  pattern: "\U0001F1F2\U0001F1F4|澳门|Macau|Macao"
  flags: i
- id: NZ
  name: 新西兰
  icon: "\U0001F1F3\U0001F1FF"
  pattern: "\U0001F1F3\U0001F1FF|新西兰|New\\s*Zealand"
  flags: i
- id: IT
  name: 意大利
  icon: "\U0001F1EE\U0001F1F9"
  pattern: "\U0001F1EE\U0001F1F9|意大利|Italy"
  flags: i
- id: NL
  name: 荷兰
  icon: "\U0001F1F3\U0001F1F1"
  pattern: "\U0001F1F3\U0001F1F1|荷兰|Netherlands"
  flags: i
- id: PL
  name: 波兰
  icon: "\U0001F1F5\U0001F1F1"
  pattern: "\U0001F1F5\U0001F1F1|波兰|Poland"
  flags: i
- id: CH
  name: 瑞士
  icon: "\U0001F1E8\U0001F1ED"
  pattern: "\U0001F1E8\U0001F1ED|瑞士|Switzerland"
  flags: i
- id: VN
  name: 越南
  icon: "\U0001F1FB\U0001F1F3"
  pattern: "\U0001F1FB\U0001F1F3|越南|Vietnam"
  flags: i
- id: TH
  name: 泰国
  icon: "\U0001F1F9\U0001F1ED"
  pattern: "\U0001F1F9\U0001F1ED|泰国|Thailand"
  flags: i
- id: PH
  name: 菲律宾
  icon: "\U0001F1F5\U0001F1ED"
  pattern: "\U0001F1F5\U0001F1ED|菲律宾|Philippines"
  flags: i
- id: MY
  name: 马来西亚
  icon: "\U0001F1F2\U0001F1FE"
  pattern: "\U0001F1F2\U0001F1FE|马来|Malaysia"
  flags: i
- id: ID
  name: 印尼
  icon: "\U0001F1EE\U0001F1E9"
  pattern: "\U0001F1EE\U0001F1E9|印尼|印度尼西亚|Indonesia"
  flags: i
- id: TR
  name: 土耳其
  icon: "\U0001F1F9\U0001F1F7"
  pattern: "\U0001F1F9\U0001F1F7|土耳其|Turkey|T\u00FCrkiye"
  flags: i
- id: AR
  name: 阿根廷
  icon: "\U0001F1E6\U0001F1F7"
  pattern: "\U0001F1E6\U0001F1F7|阿根廷|Argentina"
  flags: i
- id: BR
  name: 巴西
  icon: "\U0001F1E7\U0001F1F7"
  pattern: "\U0001F1E7\U0001F1F7|巴西|Brazil"
  flags: i
```

**重要:** js-yaml 不支持 YAML 1.1 的 `\U0001FXXX` 转义。icon 和 pattern 中的 emoji 必须使用字面量（如 `icon: "🇭🇰"`）。实现时写入文件应直接使用 emoji 字符，不使用任何转义。正则中的 emoji 同理（如 pattern 中的 `🇭🇰`）。实现时需要先用小样本测试 YAML 解析结果确认 emoji 和正则被正确还原。

- [ ] **Step 2: 创建 placeholders.yaml**

```yaml
reserved:
  - proxy_select
  - manual_select
  - auto_select
fallback: fallback
mappings:
  "@proxy-select": proxy_select
  "@manual-select": manual_select
  "@auto-select": auto_select
```

- [ ] **Step 3: 验证 YAML 能被编译管线处理**

Run: `npm run rules:build`
Expected: 输出包含 `regions.yaml -> ... regions.js` 和 `placeholders.yaml -> ... placeholders.js`

- [ ] **Step 4: 检查生成的 JS 产物内容正确**

Run: `node -e "import('./scripts/config/runtime/regions.js').then(m => console.log('regions count:', m.default.length))"`
Expected: `regions count: 27`（即 27 个区域条目）

Run: `node -e "import('./scripts/config/runtime/placeholders.js').then(m => console.log('fallback:', m.default.fallback))"`
Expected: `fallback: fallback`

- [ ] **Step 5: 提交**

```bash
git add definitions/runtime/regions.yaml definitions/runtime/placeholders.yaml
git commit -m "feat: 新增 regions.yaml 和 placeholders.yaml 配置化区域/占位符数据"
```

---

## Task 11: 重构 proxy-groups.js 引用编译产物

**Files:**
- Modify: `scripts/override/lib/proxy-groups.js`

- [ ] **Step 1: 重写 proxy-groups.js**

删除硬编码的 REGION_PATTERNS、RESERVED_GROUP_IDS、PLACEHOLDER_GROUP_IDS、FALLBACK_GROUP_ID，改为 import 编译产物:

```js
import regionsConfig from "../../config/runtime/regions.js";
import placeholdersConfig from "../../config/runtime/placeholders.js";
import { cloneData } from "./utils.js";

/**
 * 将 YAML 加载的区域配置编译为包含 RegExp 对象的运行时格式。
 * 在模块加载时执行一次，后续匹配直接使用编译后的正则。
 * @param {Array<{id: string, name: string, icon: string, pattern: string, flags?: string}>} rawRegions
 * @returns {Array<{id: string, name: string, icon: string, pattern: RegExp}>}
 */
function compileRegionPatterns(rawRegions) {
  return rawRegions.map((region) => ({
    id: region.id,
    name: region.name,
    icon: region.icon,
    pattern: new RegExp(region.pattern, region.flags || ""),
  }));
}

const REGION_PATTERNS = compileRegionPatterns(regionsConfig);
const RESERVED_GROUP_IDS = placeholdersConfig.reserved;
const FALLBACK_GROUP_ID = placeholdersConfig.fallback;
const PLACEHOLDER_GROUP_IDS = placeholdersConfig.mappings;

/**
 * 过滤出具有有效名称的代理节点。
 * @param {Array<{name?: string}>} proxies - 原始代理节点列表。
 * @returns {Array<{name: string}>} 具有非空名称的节点列表。
 */
function getNamedProxies(proxies) {
  return proxies.filter(
    (proxy) => proxy && typeof proxy.name === "string" && proxy.name.trim().length > 0,
  );
}

/**
 * 根据区域正则模式匹配代理节点名称，返回匹配到的区域 ID。
 * 采用 first-match-wins 策略: 按 REGION_PATTERNS 数组顺序依次匹配，
 * 返回第一个命中的区域 ID；全部未命中则返回 "OTHER"。
 * @param {string} proxyName - 代理节点名称。
 * @returns {string} 区域 ID。
 */
function detectRegionId(proxyName) {
  for (const region of REGION_PATTERNS) {
    if (region.pattern.test(proxyName)) {
      return region.id;
    }
  }

  return "OTHER";
}

/**
 * 将代理节点按区域分类。
 * @param {Array<{name: string}>} proxies - 已过滤的代理节点列表。
 * @returns {Record<string, Array<{name: string}>>} 区域 ID 到节点数组的映射。
 */
function classifyProxies(proxies) {
  const regionMap = { OTHER: [] };

  for (const proxy of proxies) {
    const regionId = detectRegionId(proxy.name);

    if (!regionMap[regionId]) {
      regionMap[regionId] = [];
    }

    regionMap[regionId].push(proxy);
  }

  return regionMap;
}

/**
 * 基于分类结果构建区域代理组列表。
 * @param {Array<{name: string}>} proxies - 已过滤的代理节点列表。
 * @returns {Array<{name: string, type: string, proxies: string[]}>} 区域组列表。
 */
function buildRegionGroups(proxies) {
  const regionMap = classifyProxies(proxies);
  const regionGroups = [];

  for (const region of REGION_PATTERNS) {
    const nodes = regionMap[region.id];
    if (!nodes || nodes.length === 0) {
      continue;
    }

    regionGroups.push({
      name: `${region.icon} ${region.name}`,
      type: "select",
      proxies: nodes.map((node) => node.name),
    });
  }

  return regionGroups;
}

/**
 * 展开 @-前缀的占位符目标为实际节点/组名列表。
 * 支持三类占位符:
 *   - @all-nodes: 展开为所有代理节点名称
 *   - @region-groups: 展开为所有已构建的区域组名称
 *   - @proxy-select/@manual-select/@auto-select: 展开为对应保留组的 name
 * @param {string} target - 占位符或普通目标名称。
 * @param {{allProxyNames: string[], regionGroupNames: string[], groupDefinitions: Record<string, {name: string}>}} context
 * @returns {string[]} 展开后的名称列表。
 */
function expandGroupTarget(target, context) {
  if (target === "@all-nodes") {
    return [...context.allProxyNames];
  }

  if (target === "@region-groups") {
    return [...context.regionGroupNames];
  }

  if (PLACEHOLDER_GROUP_IDS[target]) {
    const referencedId = PLACEHOLDER_GROUP_IDS[target];
    const referencedDefinition = context.groupDefinitions[referencedId];

    if (!referencedDefinition) {
      throw new Error(`占位符引用了未定义的策略组: ${target} -> ${referencedId}`);
    }

    return [referencedDefinition.name];
  }

  if (target.startsWith("@")) {
    throw new Error(`不支持的占位符: ${target}`);
  }

  return [target];
}

/**
 * 根据策略组定义构建单个代理组。
 * @param {string} groupId - 策略组 ID。
 * @param {{name: string, type: string, proxies?: string[], category?: string}} definition - 策略组定义。
 * @param {Object} context - 展开占位符所需的上下文。
 * @returns {{name: string, type: string, proxies: string[]}} 构建后的代理组。
 */
function buildConfiguredGroup(groupId, definition, context) {
  const proxies = [];
  for (const target of definition.proxies || []) {
    proxies.push(...expandGroupTarget(target, context));
  }

  const group = {};
  for (const [key, value] of Object.entries(definition)) {
    if (key === "category" || key === "proxies") {
      continue;
    }

    group[key] = cloneData(value);
  }

  if (!group.name) {
    throw new Error(`策略组 ${groupId} 缺少 name 字段`);
  }

  if (!group.type) {
    throw new Error(`策略组 ${groupId} 缺少 type 字段`);
  }

  group.proxies = proxies;
  return group;
}

/**
 * 构建完整的代理组列表: 保留组 -> 自定义组 -> 区域组 -> fallback 组。
 * @param {Array<{name: string}>} proxies - 已过滤的代理节点列表。
 * @param {Record<string, Object>} groupDefinitions - 策略组定义。
 * @returns {Array<{name: string, type: string, proxies: string[]}>} 完整的代理组列表。
 */
function buildProxyGroups(proxies, groupDefinitions) {
  const namedProxies = getNamedProxies(proxies);
  const allProxyNames = namedProxies.map((proxy) => proxy.name);
  const regionGroups = buildRegionGroups(namedProxies);
  const context = {
    allProxyNames,
    regionGroupNames: regionGroups.map((group) => group.name),
    groupDefinitions,
  };

  const groups = [];
  for (const groupId of RESERVED_GROUP_IDS) {
    groups.push(buildConfiguredGroup(groupId, groupDefinitions[groupId], context));
  }

  for (const [groupId, definition] of Object.entries(groupDefinitions)) {
    if (RESERVED_GROUP_IDS.includes(groupId) || groupId === FALLBACK_GROUP_ID) {
      continue;
    }

    groups.push(buildConfiguredGroup(groupId, definition, context));
  }

  groups.push(...regionGroups);

  groups.push(buildConfiguredGroup(FALLBACK_GROUP_ID, groupDefinitions[FALLBACK_GROUP_ID], context));
  return groups;
}

export { buildProxyGroups, getNamedProxies };
```

- [ ] **Step 2: 运行构建和验证**

Run: `npm run build && npm run verify`
Expected: 构建无错误，所有验证通过

- [ ] **Step 3: 提交**

```bash
git add scripts/override/lib/proxy-groups.js
git commit -m "refactor: proxy-groups.js 数据层剥离，引用编译产物和共享模块"
```

---

## Task 12: 重构 runtime-preset.js 和 rule-assembly.js

**Files:**
- Modify: `scripts/override/lib/runtime-preset.js`
- Modify: `scripts/override/lib/rule-assembly.js`

- [ ] **Step 1: 重写 runtime-preset.js**

```js
import baseConfig from "../../config/runtime/base.js";
import dnsConfig from "../../config/runtime/dns.js";
import geodataConfig from "../../config/runtime/geodata.js";
import profileConfig from "../../config/runtime/profile.js";
import snifferConfig from "../../config/runtime/sniffer.js";
import tunConfig from "../../config/runtime/tun.js";
import { cloneData } from "./utils.js";

/**
 * 将运行时配置分段的所有键值对深拷贝后写入目标配置对象。
 * @param {Record<string, unknown>} config - 目标配置对象。
 * @param {Record<string, unknown>} section - 运行时配置分段。
 * @returns {void}
 */
function applyRuntimeSection(config, section) {
  for (const [key, value] of Object.entries(section)) {
    config[key] = cloneData(value);
  }
}

/**
 * 将所有运行时预设应用到配置对象。
 *
 * base/profile/geodata: 无条件覆盖（这些是基础配置，必须与预设保持一致）。
 * sniffer/dns: 无条件覆盖（嗅探和 DNS 配置需要预设保证正确性，用户不应部分覆盖）。
 * allow-lan: 仅在未设置时默认启用（允许用户显式禁用局域网访问）。
 * tun: 仅在未设置时应用预设（TUN 配置涉及系统网络栈，已有配置应被保留以避免冲突）。
 *
 * @param {Record<string, unknown>} config - 目标配置对象。
 * @returns {Record<string, unknown>} 应用预设后的配置对象。
 */
function applyRuntimePreset(config) {
  applyRuntimeSection(config, baseConfig);
  applyRuntimeSection(config, profileConfig);
  applyRuntimeSection(config, geodataConfig);
  config.sniffer = cloneData(snifferConfig);
  config.dns = cloneData(dnsConfig);

  if (config["allow-lan"] === undefined) {
    config["allow-lan"] = true;
  }

  if (!config.tun) {
    config.tun = cloneData(tunConfig);
  }

  return config;
}

export { applyRuntimePreset };
```

注意: 不再导出 `cloneData`（原来导出是因为其他文件引用，现在统一从 `utils.js` 获取）。

- [ ] **Step 2: 导出 extractRuleTarget 并补充防御性检查**

在 `rule-assembly.js` 中，将 export 行改为同时导出 `extractRuleTarget`:

将第 125 行:
```js
export { assembleRuleSet };
```
改为:
```js
export { assembleRuleSet, extractRuleTarget };
```

- [ ] **Step 3: 运行构建和验证**

Run: `npm run build && npm run verify`
Expected: 构建无错误，所有验证通过

- [ ] **Step 4: 提交**

```bash
git add scripts/override/lib/runtime-preset.js scripts/override/lib/rule-assembly.js
git commit -m "refactor: runtime-preset 引用共享 cloneData，rule-assembly 导出 extractRuleTarget"
```

---

## Task 13: 重构 validate-output.js 引用 extractRuleTarget

**Files:**
- Modify: `scripts/override/lib/validate-output.js`

- [ ] **Step 1: 重写 validate-output.js**

引用 `extractRuleTarget` 消除重复的规则解析逻辑，增加 null safety:

```js
import { extractRuleTarget } from "./rule-assembly.js";

/**
 * 校验生成配置的完整性和正确性。
 * 检查 proxy-groups 结构、规则引用、MATCH 位置等。
 * @param {Record<string, unknown>} config - 生成后的配置对象。
 * @param {Record<string, {name: string}>} groupDefinitions - 策略组定义。
 * @returns {void}
 */
function validateOutput(config, groupDefinitions) {
  const proxyGroups = Array.isArray(config["proxy-groups"]) ? config["proxy-groups"] : [];
  const rules = Array.isArray(config.rules) ? config.rules : [];

  if (!groupDefinitions.fallback) {
    throw new Error("策略组定义中缺少 fallback 组");
  }

  const fallbackName = groupDefinitions.fallback.name;

  if (!fallbackName) {
    throw new Error("fallback 策略组缺少 name 字段");
  }

  if (!proxyGroups.length) {
    throw new Error("缺少 proxy-groups");
  }

  if (!rules.length) {
    throw new Error("缺少 rules");
  }

  const proxyGroupNames = new Set(proxyGroups.map((group) => group.name));

  for (const definition of Object.values(groupDefinitions)) {
    if (!proxyGroupNames.has(definition.name)) {
      throw new Error(`缺少已配置的策略组: ${definition.name}`);
    }
  }

  for (const group of proxyGroups) {
    if (!Array.isArray(group.proxies) || group.proxies.length === 0) {
      throw new Error(`策略组节点为空: ${group.name}`);
    }

    for (const target of group.proxies) {
      if (typeof target === "string" && target.startsWith("@")) {
        throw new Error(`策略组 ${group.name} 中存在未展开的占位符: ${target}`);
      }
    }
  }

  let matchRuleFound = false;

  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    if (typeof rule !== "string") {
      throw new Error(`规则类型无效（索引 ${index}）`);
    }

    if (rule.startsWith("RULE-SET,")) {
      const targetGroupName = extractRuleTarget(rule);

      if (!proxyGroupNames.has(targetGroupName)) {
        throw new Error(`RULE-SET 引用了不存在的策略组: ${targetGroupName}`);
      }

      continue;
    }

    if (rule.startsWith("MATCH,")) {
      if (index !== rules.length - 1) {
        throw new Error("MATCH 规则必须位于最后一条");
      }

      if (rule !== `MATCH,${fallbackName}`) {
        throw new Error(`MATCH 规则必须指向 fallback 策略组: ${fallbackName}`);
      }

      matchRuleFound = true;
    }
  }

  if (!matchRuleFound) {
    throw new Error("缺少 fallback MATCH 规则");
  }
}

export { validateOutput };
```

- [ ] **Step 2: 运行构建和验证**

Run: `npm run build && npm run verify`
Expected: 构建无错误，所有验证通过

- [ ] **Step 3: 提交**

```bash
git add scripts/override/lib/validate-output.js
git commit -m "refactor: validate-output.js 引用 extractRuleTarget，增加 null safety"
```

---

## Task 14: 删除 logger.js 并最终验证

**Files:**
- Delete: `scripts/utils/logger.js`

- [ ] **Step 1: 确认 logger.js 无人引用**

Run: `grep -r "logger" scripts/ tools/ build.js --include="*.js" -l`
Expected: 仅返回 `scripts/utils/logger.js` 自身（或无结果）

- [ ] **Step 2: 删除 logger.js**

```bash
rm scripts/utils/logger.js
```

如果 `scripts/utils/` 目录变空，也一并删除:

```bash
rmdir scripts/utils 2>/dev/null || true
```

- [ ] **Step 3: 运行完整验证**

Run: `npm run verify`
Expected: 所有验证通过

- [ ] **Step 4: 运行示例配置生成**

Run: `npm run example:config`
Expected: 无错误，输出 `Wrote example config to ...`

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "refactor: 删除无用的 logger.js"
```

---

## Task 15: 最终全量验证

- [ ] **Step 1: 清理并重新构建**

```bash
rm -rf dist/ scripts/config/
npm run build
```

Expected: 构建成功

- [ ] **Step 2: 运行全部验证**

Run: `npm run verify`
Expected: 所有验证通过

- [ ] **Step 3: 生成示例配置**

Run: `npm run example:config`
Expected: 无错误

- [ ] **Step 4: 检查 git diff 确认改动范围**

```bash
git diff --stat HEAD~14
```

Expected: 确认改动范围符合设计文档的文件变更汇总

import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

import { pathExists, listEntries } from "./lib/fs-helpers.js";
import {
  CANONICAL_NAMESPACES,
  CANONICAL_ROOT_NAME,
  GENERATED_ROOT_NAME,
  CANONICAL_TOP_LEVEL_NAMES,
} from "./lib/paths.js";

/**
 * 已废弃但仍可能残留在 scripts/config/ 下的历史目录名。
 * 这些目录已不在 CANONICAL_NAMESPACES 中，但需在每次构建时清理，
 * 防止旧版生成产物干扰新构建。新增/移除项时请同步更新。
 */
const LEGACY_GENERATED_DIRS = ["runtime"];

/**
 * 递归收集指定目录下的所有 YAML 文件路径。
 * @param {string} dir - 待扫描的目录路径。
 * @returns {Promise<string[]>} YAML 文件的绝对路径列表。
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
      throw new Error(`YAML 命名空间下不支持该文件类型: ${fullPath}`);
    }

    files.push(fullPath);
  }

  return files;
}

/**
 * 校验 canonical（definitions/）布局的目录结构是否合法。
 * @param {string} rootDir - definitions/ 根目录的绝对路径。
 * @returns {Promise<void>}
 */
async function validateCanonicalLayout(rootDir) {
  const rootEntries = await listEntries(rootDir);

  for (const entry of rootEntries) {
    if (!CANONICAL_TOP_LEVEL_NAMES.has(entry.name)) {
      throw new Error(`definitions/ 下存在不支持的条目: ${entry.name}`);
    }
  }
}

/**
 * 探测并返回当前工作目录下的源定义树信息。
 * @param {string} cwd - 项目根目录。
 * @returns {Promise<{kind: string, rootDir: string, namespaces: object[]}>}
 */
async function resolveSourceTree(cwd) {
  const canonicalRoot = path.join(cwd, CANONICAL_ROOT_NAME);

  if (!(await pathExists(canonicalRoot))) {
    throw new Error("未找到 definitions/ 源定义树");
  }

  await validateCanonicalLayout(canonicalRoot);
  return {
    kind: "canonical",
    rootDir: canonicalRoot,
    namespaces: CANONICAL_NAMESPACES,
  };
}

/**
 * 收集指定命名空间下的所有 YAML 文件。
 * @param {string} rootDir - 源定义根目录。
 * @param {{sourceSubdir: string}} namespace - 命名空间配置。
 * @returns {Promise<{files: string[], inputRoot: string}>}
 */
async function collectNamespaceFiles(rootDir, namespace) {
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
 * 将单个 YAML 文件转换为 JS 模块并写入输出目录。
 * @param {string} inputFile - 输入 YAML 文件的绝对路径。
 * @param {string} inputRoot - 输入根目录，用于计算相对路径。
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
 * 将 YAML 定义文件编译为 JS 模块，输出到 scripts/config/。
 * @param {object} [options]
 * @param {string} [options.cwd] - 项目根目录，默认为 process.cwd()。
 * @param {Function} [options.log] - 日志函数，默认为 console.log。
 * @param {string[]} [options.requiredNamespaces] - 需要编译的命名空间列表；不传则编译所有。
 * @returns {Promise<{sourceTree: string, results: Array<{inputFile: string, outputFile: string}>}>}
 */
async function buildYamlModules({
  cwd = process.cwd(),
  log = console.log,
  requiredNamespaces,
} = {}) {
  const activeTree = await resolveSourceTree(cwd);
  const required = new Set(
    requiredNamespaces ?? CANONICAL_NAMESPACES.map((namespace) => namespace.name),
  );

  // 清理本次会重建的命名空间产物（按 outputSubdir 派生），以及历史遗留目录。
  const dirsToClean = [
    ...CANONICAL_NAMESPACES.map((namespace) => namespace.outputSubdir),
    ...LEGACY_GENERATED_DIRS,
  ];
  await Promise.all(
    dirsToClean.map((dirName) =>
      fs.rm(path.join(cwd, GENERATED_ROOT_NAME, dirName), {
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
      log(`已转换: ${path.relative(cwd, result.inputFile)} -> ${path.relative(cwd, result.outputFile)}`);
    }
  }

  if (results.length === 0) {
    throw new Error("未生成任何 YAML 模块");
  }

  log(`完成，共转换 ${results.length} 个文件。`);
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

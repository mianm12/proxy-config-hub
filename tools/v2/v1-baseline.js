import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import chainsConfig from "../../scripts/config/proxy-groups/chains.js";
import groupDefinitionsConfig from "../../scripts/config/proxy-groups/groupDefinitions.js";
import regionsConfig from "../../scripts/config/proxy-groups/regions.js";
import ruleProvidersConfig from "../../scripts/config/rules/ruleProviders.js";
import { loadBundleRuntime, loadTemplateProxies } from "../lib/bundle-runtime.js";
import {
  REPO_ROOT,
  V1_FIXTURE_INPUT_DIR,
  V1_GOLDEN_INVENTORY_PATH,
  V1_GOLDEN_OUTPUT_DIR,
  V1_GOLDEN_RENAME_DIR,
  V1_RENAME_SCRIPT_PATH,
  resolve,
} from "../lib/paths.js";

const BASELINE_COMMIT = "3ed814bf4b1e1d208accd89298f779f18bae2a0c";
const UPDATE_MODE = process.argv.includes("--update");
const UNKNOWN_ARGS = process.argv.slice(2).filter((arg) => arg !== "--update");

const V1_SOURCE_ROOTS = [
  resolve("definitions", "mihomo-preset"),
  resolve("definitions", "proxy-groups"),
  resolve("definitions", "rules"),
  resolve("scripts", "config"),
  resolve("scripts", "override"),
  V1_RENAME_SCRIPT_PATH,
  resolve("build.js"),
  resolve("tools", "yaml-to-js.js"),
];

if (UNKNOWN_ARGS.length > 0) {
  throw new Error(`未知参数: ${UNKNOWN_ARGS.join(", ")}`);
}

/**
 * 把值规范化为稳定、可审阅的 JSON 文本。
 * @param {unknown} value 待序列化值。
 * @returns {string} 以换行结尾的格式化 JSON。
 */
function stringifyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * 读取并解析 JSON fixture。
 * @param {string} filePath fixture 绝对路径。
 * @returns {Record<string, unknown>} fixture 对象。
 */
function readJson(filePath) {
  const value = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`fixture 必须为对象: ${path.relative(REPO_ROOT, filePath)}`);
  }

  return value;
}

/**
 * 按文件名顺序列出目录中的 JSON fixture。
 * @param {string} directory 目录绝对路径。
 * @returns {string[]} JSON 文件绝对路径列表。
 */
function listJsonFixtures(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(directory, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

/**
 * 确保 fixture 与 golden 文件一一对应，避免删除或重命名 fixture 后遗留旧基线。
 * @param {string[]} fixturePaths fixture 文件列表。
 * @param {string} goldenDirectory golden 目录。
 * @returns {void}
 */
function assertGoldenFileSet(fixturePaths, goldenDirectory) {
  const expected = fixturePaths.map((filePath) => path.basename(filePath)).sort();
  const actual = listJsonFixtures(goldenDirectory).map((filePath) => path.basename(filePath));

  if (stringifyJson(actual) !== stringifyJson(expected)) {
    throw new Error(
      `fixture 与 golden 文件集合不一致: ${relativePath(goldenDirectory)}\n` +
        `期望: ${expected.join(", ")}\n实际: ${actual.join(", ")}`,
    );
  }
}

/**
 * 递归列出文件，用于锁定 v1 行为源的内容摘要。
 * @param {string} sourcePath 文件或目录绝对路径。
 * @returns {string[]} 文件绝对路径列表。
 */
function listFiles(sourcePath) {
  const stat = fs.statSync(sourcePath);

  if (stat.isFile()) {
    return [sourcePath];
  }

  return fs
    .readdirSync(sourcePath, { withFileTypes: true })
    .flatMap((entry) => listFiles(path.join(sourcePath, entry.name)))
    .sort((left, right) => left.localeCompare(right));
}

/**
 * 返回仓库相对路径，统一使用正斜杠。
 * @param {string} filePath 文件绝对路径。
 * @returns {string} 仓库相对路径。
 */
function relativePath(filePath) {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join("/");
}

/**
 * 计算文件 SHA-256。
 * @param {string} filePath 文件绝对路径。
 * @returns {string} 小写十六进制摘要。
 */
function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

/**
 * 构造 v1 声明顺序与源码摘要清单。
 * @returns {Record<string, unknown>} 可稳定比较的 inventory。
 */
function buildInventory() {
  const sourceFiles = V1_SOURCE_ROOTS.flatMap(listFiles).sort((left, right) =>
    left.localeCompare(right),
  );
  const { groupDefinitions } = groupDefinitionsConfig;
  const { ruleProviders } = ruleProvidersConfig;
  const regions = Array.isArray(regionsConfig) ? regionsConfig : (regionsConfig.regions ?? []);
  const transitGroups = chainsConfig.transit_group ?? [];
  const chainGroups = chainsConfig.chain_group ?? [];

  return {
    baselineCommit: BASELINE_COMMIT,
    counts: {
      groups: Object.keys(groupDefinitions).length,
      providers: Object.keys(ruleProviders).length,
      regions: regions.length,
    },
    groupOrder: Object.entries(groupDefinitions).map(([id, group]) => ({ id, name: group.name })),
    providerOrder: Object.keys(ruleProviders),
    regionOrder: regions.map(({ id, name, icon }) => ({ id, name, icon })),
    topology: {
      transitGroups: transitGroups.map(({ id, name }) => ({ id, name })),
      chainGroups: chainGroups.map(({ id, name, entry }) => ({ id, name, entry })),
    },
    sourceDigests: Object.fromEntries(
      sourceFiles.map((filePath) => [relativePath(filePath), sha256(filePath)]),
    ),
  };
}

/**
 * 执行一个 override case 并保留日志与完整结构化输出。
 * @param {Record<string, unknown>} testCase override case。
 * @returns {{name: string, logs: string[], config: unknown}} 基线结果。
 */
function runOverrideCase(testCase) {
  if (typeof testCase.name !== "string" || testCase.name.length === 0) {
    throw new Error("override case 缺少非空 name");
  }

  const input = testCase.template
    ? { proxies: loadTemplateProxies() }
    : JSON.parse(JSON.stringify(testCase.config));
  const { main, logs } = loadBundleRuntime();

  if (typeof main !== "function") {
    throw new Error("v1 override bundle 未暴露 main 函数");
  }

  return {
    name: testCase.name,
    logs,
    config: main(input),
  };
}

/**
 * 执行一个 override fixture。
 * @param {string} filePath fixture 绝对路径。
 * @returns {{fixture: string, cases: unknown[]}} fixture 基线结果。
 */
function runOverrideFixture(filePath) {
  const fixture = readJson(filePath);

  if (!Array.isArray(fixture.cases) || fixture.cases.length === 0) {
    throw new Error(`override fixture 缺少 cases: ${relativePath(filePath)}`);
  }

  return {
    fixture: path.basename(filePath, ".json"),
    cases: fixture.cases.map(runOverrideCase),
  };
}

/**
 * 在隔离 VM 中加载旧 rename 脚本并执行 operator 契约。
 * @param {Record<string, unknown>} fixture rename fixture。
 * @returns {{fixture: string, arguments: unknown, logs: string[], proxies: unknown}} 基线结果。
 */
function runRenameFixture(fixture) {
  if (typeof fixture.name !== "string" || fixture.name.length === 0) {
    throw new Error("rename fixture 缺少非空 name");
  }
  if (!fixture.arguments || typeof fixture.arguments !== "object") {
    throw new Error(`rename fixture ${fixture.name} 缺少 arguments`);
  }
  if (!Array.isArray(fixture.proxies)) {
    throw new Error(`rename fixture ${fixture.name} 缺少 proxies`);
  }

  const logs = [];
  const context = {
    $arguments: JSON.parse(JSON.stringify(fixture.arguments)),
    console: {
      log: (...args) => logs.push(args.map(String).join(" ")),
      warn: (...args) => logs.push(args.map(String).join(" ")),
      error: (...args) => logs.push(args.map(String).join(" ")),
    },
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(V1_RENAME_SCRIPT_PATH, "utf8"), context, {
    filename: V1_RENAME_SCRIPT_PATH,
  });

  const operator = vm.runInContext("operator", context);
  if (typeof operator !== "function") {
    throw new Error("v1 rename 脚本未暴露 operator 函数");
  }

  const proxies = JSON.parse(JSON.stringify(fixture.proxies));
  const result = operator(proxies, fixture.targetPlatform ?? "ClashMeta", fixture.context ?? {});

  return {
    fixture: fixture.name,
    arguments: fixture.arguments,
    logs,
    proxies: result,
  };
}

/**
 * 更新或校验单个 golden 文件。
 * @param {string} outputPath golden 绝对路径。
 * @param {unknown} value 期望内容。
 * @returns {void}
 */
function writeOrCheck(outputPath, value) {
  const actual = stringifyJson(value);

  if (UPDATE_MODE) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, actual, "utf8");
    return;
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error(`缺少 v1 golden: ${relativePath(outputPath)}`);
  }

  const expected = fs.readFileSync(outputPath, "utf8");
  if (actual !== expected) {
    throw new Error(
      `v1 基线漂移: ${relativePath(outputPath)}。确认变更后运行 npm run baseline:v1:update`,
    );
  }
}

const overrideInputDir = path.join(V1_FIXTURE_INPUT_DIR, "override");
const renameInputDir = path.join(V1_FIXTURE_INPUT_DIR, "rename");
const overrideFixtures = listJsonFixtures(overrideInputDir);
const renameFixtures = listJsonFixtures(renameInputDir);

for (const fixturePath of overrideFixtures) {
  const outputPath = path.join(V1_GOLDEN_OUTPUT_DIR, path.basename(fixturePath));
  writeOrCheck(outputPath, runOverrideFixture(fixturePath));
}

for (const fixturePath of renameFixtures) {
  const fixture = readJson(fixturePath);
  const outputPath = path.join(V1_GOLDEN_RENAME_DIR, path.basename(fixturePath));
  writeOrCheck(outputPath, runRenameFixture(fixture));
}

writeOrCheck(V1_GOLDEN_INVENTORY_PATH, buildInventory());
assertGoldenFileSet(overrideFixtures, V1_GOLDEN_OUTPUT_DIR);
assertGoldenFileSet(renameFixtures, V1_GOLDEN_RENAME_DIR);

console.log(UPDATE_MODE ? "v1 基线 golden 已更新" : "v1 基线 golden 校验通过");

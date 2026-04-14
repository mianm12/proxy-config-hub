import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { promises as fsp } from "node:fs";

import { buildYamlModules } from "./yaml-to-js.js";
import { copyFile } from "./lib/fs-helpers.js";
import {
  REPO_ROOT,
  DEFINITIONS_DIR,
  CANONICAL_NAMESPACES,
} from "./lib/paths.js";

/**
 * 创建临时工作区目录。
 * @param {string} prefix - 目录名前缀。
 * @returns {Promise<string>} 临时目录的绝对路径。
 */
async function createTempWorkspace(prefix) {
  return fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

/**
 * 读取工作区内的生成文件内容。
 * @param {string} workspaceRoot - 工作区根目录路径。
 * @param {string} relativePath - 文件相对路径。
 * @returns {Promise<string>} 文件的 UTF-8 文本内容。
 */
async function readGeneratedFile(workspaceRoot, relativePath) {
  return fsp.readFile(path.join(workspaceRoot, relativePath), "utf8");
}

/**
 * 扫描指定命名空间子目录下的所有 YAML 文件名。
 * @param {string} sourceSubdir - 相对于 DEFINITIONS_DIR 的子目录路径。
 * @returns {string[]} 该目录中所有 YAML 文件名（不含路径）。
 */
function scanDefinitionFiles(sourceSubdir) {
  const sourceDir = path.join(DEFINITIONS_DIR, sourceSubdir);
  return fs.readdirSync(sourceDir).filter((name) => /\.(ya?ml)$/i.test(name));
}

/**
 * 构建 canonical 工作区：将 definitions/ 下各命名空间的 YAML 文件复制到临时目录。
 * @returns {Promise<string>} canonical 工作区的绝对路径。
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
 * 断言指定命名空间的编译产物与仓库中的产物完全一致。
 * @param {string} workspaceRoot - 工作区根目录路径。
 * @param {string} outputSubdir - 相对于 scripts/config/ 的输出子目录。
 * @param {string} sourceSubdir - 相对于 DEFINITIONS_DIR 的源子目录。
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
 * 构建 legacy 工作区：将 registry 中的关键 YAML 文件以旧版 rules/ 布局复制到临时目录。
 * @returns {Promise<string>} legacy 工作区的绝对路径。
 */
async function setupLegacyWorkspace() {
  const workspaceRoot = await createTempWorkspace("proxy-config-hub-rules-");
  const registryDir = path.join(DEFINITIONS_DIR, "rules", "registry");

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
 * 断言 definitions/ 与 rules/ 同时存在时构建应抛出错误。
 * @returns {Promise<void>}
 */
async function assertMixedRootsFail() {
  const workspaceRoot = await createTempWorkspace("proxy-config-hub-mixed-");

  try {
    const registryDir = path.join(DEFINITIONS_DIR, "rules", "registry");

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

    assert.equal(didThrow, true, "mixed legacy/canonical roots should hard fail");
  } finally {
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
  }
}

/**
 * 主验证流程：构建 canonical/legacy 工作区，编译并对比产物，验证混合布局报错。
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
      "legacy rules/ conversion must match canonical definitions output",
    );
    assert.equal(
      canonicalRuleProviders,
      legacyRuleProviders,
      "legacy rules/ conversion must match canonical definitions output",
    );
    assert.equal(
      false,
      await fsp
        .access(path.join(canonicalWorkspace, "scripts", "config", "rules", "custom", "_template.js"))
        .then(() => true)
        .catch(() => false),
      "custom templates must never be converted into scripts/config",
    );

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

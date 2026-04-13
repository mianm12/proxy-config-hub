import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildYamlModules } from "./yaml-to-js.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function copyFile(sourcePath, targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

async function createTempWorkspace(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function readGeneratedFile(workspaceRoot, relativePath) {
  return fs.readFile(path.join(workspaceRoot, relativePath), "utf8");
}

async function setupCanonicalWorkspace() {
  const workspaceRoot = await createTempWorkspace("proxy-config-hub-definitions-");

  await copyFile(
    path.join(REPO_ROOT, "definitions", "rules", "registry", "groupDefinitions.yaml"),
    path.join(workspaceRoot, "definitions", "rules", "registry", "groupDefinitions.yaml"),
  );
  await copyFile(
    path.join(REPO_ROOT, "definitions", "rules", "registry", "ruleProviders.yaml"),
    path.join(workspaceRoot, "definitions", "rules", "registry", "ruleProviders.yaml"),
  );

  return workspaceRoot;
}

async function setupLegacyWorkspace() {
  const workspaceRoot = await createTempWorkspace("proxy-config-hub-rules-");

  await copyFile(
    path.join(REPO_ROOT, "definitions", "rules", "registry", "groupDefinitions.yaml"),
    path.join(workspaceRoot, "rules", "groupDefinitions.yaml"),
  );
  await copyFile(
    path.join(REPO_ROOT, "definitions", "rules", "registry", "ruleProviders.yaml"),
    path.join(workspaceRoot, "rules", "ruleProviders.yaml"),
  );

  return workspaceRoot;
}

async function assertMixedRootsFail() {
  const workspaceRoot = await createTempWorkspace("proxy-config-hub-mixed-");

  try {
    await copyFile(
      path.join(REPO_ROOT, "definitions", "rules", "registry", "groupDefinitions.yaml"),
      path.join(workspaceRoot, "definitions", "rules", "registry", "groupDefinitions.yaml"),
    );
    await copyFile(
      path.join(REPO_ROOT, "definitions", "rules", "registry", "ruleProviders.yaml"),
      path.join(workspaceRoot, "definitions", "rules", "registry", "ruleProviders.yaml"),
    );
    await copyFile(
      path.join(REPO_ROOT, "definitions", "rules", "registry", "groupDefinitions.yaml"),
      path.join(workspaceRoot, "rules", "groupDefinitions.yaml"),
    );
    await copyFile(
      path.join(REPO_ROOT, "definitions", "rules", "registry", "ruleProviders.yaml"),
      path.join(workspaceRoot, "rules", "ruleProviders.yaml"),
    );

    let didThrow = false;
    try {
      await buildYamlModules({ cwd: workspaceRoot, requiredNamespaces: ["rules"], log: () => {} });
    } catch (error) {
      didThrow = /cannot coexist/.test(error.message);
    }

    assert.equal(didThrow, true, "mixed legacy/canonical roots should hard fail");
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function main() {
  const canonicalWorkspace = await setupCanonicalWorkspace();
  const legacyWorkspace = await setupLegacyWorkspace();

  try {
    await buildYamlModules({ cwd: canonicalWorkspace, requiredNamespaces: ["rules"], log: () => {} });
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
      await fs
        .access(path.join(canonicalWorkspace, "scripts", "config", "rules", "custom", "_template.js"))
        .then(() => true)
        .catch(() => false),
      "custom templates must never be converted into scripts/config",
    );

    await assertMixedRootsFail();
    console.log("YAML migration verification passed");
  } finally {
    await Promise.all([
      fs.rm(canonicalWorkspace, { recursive: true, force: true }),
      fs.rm(legacyWorkspace, { recursive: true, force: true }),
    ]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

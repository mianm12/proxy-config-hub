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
    path.join(REPO_ROOT, "definitions", "rules", "registry", "inlineRules.yaml"),
    path.join(workspaceRoot, "definitions", "rules", "registry", "inlineRules.yaml"),
  );
  await copyFile(
    path.join(REPO_ROOT, "definitions", "rules", "registry", "ruleProviders.yaml"),
    path.join(workspaceRoot, "definitions", "rules", "registry", "ruleProviders.yaml"),
  );
  await copyFile(
    path.join(REPO_ROOT, "definitions", "runtime", "base.yaml"),
    path.join(workspaceRoot, "definitions", "runtime", "base.yaml"),
  );
  await copyFile(
    path.join(REPO_ROOT, "definitions", "runtime", "dns.yaml"),
    path.join(workspaceRoot, "definitions", "runtime", "dns.yaml"),
  );
  await copyFile(
    path.join(REPO_ROOT, "definitions", "runtime", "geodata.yaml"),
    path.join(workspaceRoot, "definitions", "runtime", "geodata.yaml"),
  );
  await copyFile(
    path.join(REPO_ROOT, "definitions", "runtime", "profile.yaml"),
    path.join(workspaceRoot, "definitions", "runtime", "profile.yaml"),
  );
  await copyFile(
    path.join(REPO_ROOT, "definitions", "runtime", "sniffer.yaml"),
    path.join(workspaceRoot, "definitions", "runtime", "sniffer.yaml"),
  );
  await copyFile(
    path.join(REPO_ROOT, "definitions", "runtime", "tun.yaml"),
    path.join(workspaceRoot, "definitions", "runtime", "tun.yaml"),
  );

  return workspaceRoot;
}

async function assertCanonicalRuntimeOutputs(workspaceRoot) {
  const runtimeFiles = ["base.js", "dns.js", "geodata.js", "profile.js", "sniffer.js", "tun.js"];

  for (const fileName of runtimeFiles) {
    const relativePath = path.join("scripts", "config", "runtime", fileName);
    assert.equal(
      await readGeneratedFile(workspaceRoot, relativePath),
      await readGeneratedFile(REPO_ROOT, relativePath),
      `canonical runtime conversion must match repository output: ${fileName}`,
    );
  }
}

async function assertCanonicalRulesOutputs(workspaceRoot) {
  const ruleFiles = ["groupDefinitions.js", "inlineRules.js", "ruleProviders.js"];

  for (const fileName of ruleFiles) {
    const relativePath = path.join("scripts", "config", "rules", fileName);
    assert.equal(
      await readGeneratedFile(workspaceRoot, relativePath),
      await readGeneratedFile(REPO_ROOT, relativePath),
      `canonical rules conversion must match repository output: ${fileName}`,
    );
  }
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
      await fs
        .access(path.join(canonicalWorkspace, "scripts", "config", "rules", "custom", "_template.js"))
        .then(() => true)
        .catch(() => false),
      "custom templates must never be converted into scripts/config",
    );

    await assertCanonicalRulesOutputs(canonicalWorkspace);
    await assertCanonicalRuntimeOutputs(canonicalWorkspace);
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

import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const CANONICAL_ROOT_NAME = "definitions";
const LEGACY_ROOT_NAME = "rules";
const GENERATED_ROOT_NAME = path.join("scripts", "config");
const CANONICAL_TOP_LEVEL_NAMES = new Set(["rules", "runtime"]);
const CANONICAL_RULES_NAMES = new Set(["registry", "custom"]);
const LEGACY_ALLOWED_ENTRIES = new Set(["groupDefinitions.yaml", "ruleProviders.yaml", "custom"]);

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

const LEGACY_NAMESPACES = [
  {
    name: "rules",
    type: "files",
    sourceFiles: ["groupDefinitions.yaml", "ruleProviders.yaml"],
    outputSubdir: "rules",
  },
];

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listEntries(dir) {
  if (!(await pathExists(dir))) {
    return [];
  }

  return fs.readdir(dir, { withFileTypes: true });
}

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
      throw new Error(`Unsupported file under YAML namespace: ${fullPath}`);
    }

    files.push(fullPath);
  }

  return files;
}

async function validateCanonicalLayout(rootDir) {
  const rootEntries = await listEntries(rootDir);

  for (const entry of rootEntries) {
    if (!CANONICAL_TOP_LEVEL_NAMES.has(entry.name)) {
      throw new Error(`Unsupported entry under definitions/: ${entry.name}`);
    }
  }

  const rulesDir = path.join(rootDir, "rules");
  const rulesEntries = await listEntries(rulesDir);

  for (const entry of rulesEntries) {
    if (!CANONICAL_RULES_NAMES.has(entry.name)) {
      throw new Error(`Unsupported entry under definitions/rules/: ${entry.name}`);
    }
  }
}

async function validateLegacyLayout(rootDir) {
  const rootEntries = await listEntries(rootDir);

  for (const entry of rootEntries) {
    if (!LEGACY_ALLOWED_ENTRIES.has(entry.name)) {
      throw new Error(`Unsupported entry under legacy rules/: ${entry.name}`);
    }
  }
}

async function resolveSourceTree(cwd) {
  const canonicalRoot = path.join(cwd, CANONICAL_ROOT_NAME);
  const legacyRoot = path.join(cwd, LEGACY_ROOT_NAME);
  const canonicalExists = await pathExists(canonicalRoot);
  const legacyExists = await pathExists(legacyRoot);

  if (canonicalExists && legacyExists) {
    throw new Error("definitions/ and rules/ cannot coexist during build");
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

  throw new Error("Neither definitions/ nor rules/ source trees were found");
}

async function collectNamespaceFiles(rootDir, namespace) {
  if (namespace.type === "files") {
    const files = [];

    for (const relativePath of namespace.sourceFiles) {
      const fullPath = path.join(rootDir, relativePath);
      if (!(await pathExists(fullPath))) {
        throw new Error(`Missing required YAML file: ${fullPath}`);
      }

      files.push(fullPath);
    }

    return { files, inputRoot: rootDir };
  }

  const namespaceRoot = path.join(rootDir, namespace.sourceSubdir);

  if (!(await pathExists(namespaceRoot))) {
    throw new Error(`Missing required namespace: ${namespaceRoot}`);
  }

  return {
    files: await walkYamlFiles(namespaceRoot),
    inputRoot: namespaceRoot,
  };
}

async function convertOne(inputFile, inputRoot, outputRoot) {
  const relativePath = path.relative(inputRoot, inputFile);
  const outputFile = path.join(outputRoot, relativePath.replace(/\.(ya?ml)$/i, ".js"));
  const text = await fs.readFile(inputFile, "utf8");
  const data = yaml.load(text);

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `export default ${JSON.stringify(data, null, 2)};\n`, "utf8");

  return { inputFile, outputFile };
}

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
      throw new Error(`Missing configured namespace: ${namespaceName}`);
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
    throw new Error("No YAML modules were generated");
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

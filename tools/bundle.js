"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { loadSourcesFromFile } = require("./yaml-lite");

const ENTRY_FILES = [
  "scripts/override/main.js",
  "scripts/override/routing-only.js",
  "scripts/override/dns-leak-fix.js"
];

const REQUIRE_PATTERN = /\brequire\(\s*["']([^"']+)["']\s*\)/g;
const LIB_DIRECTORY = "scripts/_lib/";

function createModuleVariableName(relativePath) {
  return `__bundle_${relativePath.replace(/[^A-Za-z0-9]+/g, "_")}`;
}

function indentBlock(source, indent = "  ") {
  return source
    .split("\n")
    .map((line) => (line.length > 0 ? `${indent}${line}` : line))
    .join("\n");
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function resolveModulePath(fromFilePath, request) {
  if (!request.startsWith(".")) {
    throw new Error(`Unsupported non-relative require in ${fromFilePath}: ${request}`);
  }

  const basePath = path.resolve(path.dirname(fromFilePath), request);
  const candidatePaths = [basePath, `${basePath}.js`, path.join(basePath, "index.js")];

  for (const candidatePath of candidatePaths) {
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      return candidatePath;
    }
  }

  throw new Error(`Unable to resolve require in ${fromFilePath}: ${request}`);
}

function ensureNoRequireCalls(source, filePath, context) {
  if (/\brequire\s*\(/.test(source)) {
    throw new Error(`Unsupported require pattern remained after bundling in ${context}: ${filePath}`);
  }

  return source;
}

function renderBundledModule(repoRoot, filePath) {
  const relativePath = path.relative(repoRoot, filePath).split(path.sep).join("/");
  const moduleSource = fs.readFileSync(filePath, "utf8").trimEnd();

  if (!relativePath.startsWith(LIB_DIRECTORY)) {
    throw new Error(`Only ${LIB_DIRECTORY} modules can be bundled in v1: ${relativePath}`);
  }

  ensureNoRequireCalls(moduleSource, relativePath, "_lib module");

  const variableName = createModuleVariableName(relativePath);
  const source = [
    `// --- bundled module: ${relativePath} ---`,
    "// v1 expects _lib modules to export an object because override entries destructure module.exports.",
    `const ${variableName} = (() => {`,
    "  const module = { exports: {} };",
    "  const exports = module.exports;",
    indentBlock(moduleSource),
    "  return module.exports;",
    "})();"
  ].join("\n");

  return {
    relativePath,
    variableName,
    source
  };
}

function bundleEntrySource(repoRoot, absoluteEntryPath, sourcesData) {
  const bundledModules = [];
  const bundledModulesByPath = new Map();
  const entrySource = fs.readFileSync(absoluteEntryPath, "utf8").trimEnd();
  const replacedEntrySource = entrySource
    .replace(REQUIRE_PATTERN, (_, request) => {
      const resolvedPath = resolveModulePath(absoluteEntryPath, request);
      let moduleRecord = bundledModulesByPath.get(resolvedPath);

      if (!moduleRecord) {
        moduleRecord = renderBundledModule(repoRoot, resolvedPath);
        bundledModulesByPath.set(resolvedPath, moduleRecord);
        bundledModules.push(moduleRecord.source);
      }

      return moduleRecord.variableName;
    })
    .replace("__SOURCES_DATA__", JSON.stringify(sourcesData, null, 2));

  return {
    bundledModules,
    entrySource: ensureNoRequireCalls(
      replacedEntrySource,
      path.relative(repoRoot, absoluteEntryPath),
      "override entry"
    )
  };
}

function bundleEntry(repoRoot, entryPath, sourcesData) {
  const absoluteEntryPath = path.join(repoRoot, entryPath);
  const { bundledModules, entrySource } = bundleEntrySource(repoRoot, absoluteEntryPath, sourcesData);
  const bundled = [...bundledModules, entrySource].filter(Boolean).join("\n\n");
  const outputPath = path.join(repoRoot, "dist", entryPath);
  ensureDirectory(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${bundled.trimEnd()}\n`);

  return outputPath;
}

function copyDirectory(repoRoot, relativeSourcePath) {
  const sourcePath = path.join(repoRoot, relativeSourcePath);
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  const targetPath = path.join(repoRoot, "dist", relativeSourcePath);
  ensureDirectory(targetPath);

  for (const fileName of fs.readdirSync(sourcePath)) {
    fs.copyFileSync(path.join(sourcePath, fileName), path.join(targetPath, fileName));
  }
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const sourcesData = loadSourcesFromFile(path.join(repoRoot, "rules", "sources.yaml")).sources;

  const outputs = ENTRY_FILES.map((entryPath) => bundleEntry(repoRoot, entryPath, sourcesData));
  copyDirectory(repoRoot, "rules/custom");

  for (const outputPath of outputs) {
    console.log(`Bundled ${path.relative(repoRoot, outputPath)}`);
  }
}

main();

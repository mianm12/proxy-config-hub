"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { loadSourcesFromFile } = require("./yaml-lite");

const ENTRY_FILES = [
  "scripts/override/main.js",
  "scripts/override/routing-only.js",
  "scripts/override/dns-leak-fix.js"
];

function sanitizeInlinedModule(moduleSource) {
  let sanitized = moduleSource.replace(/^"use strict";\n\n?/, "").trimEnd();
  const exportBlockIndex = sanitized.lastIndexOf('\nif (typeof module !== "undefined") {');

  if (exportBlockIndex !== -1) {
    sanitized = sanitized.slice(0, exportBlockIndex).trimEnd();
  }

  return sanitized;
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function bundleEntry(repoRoot, entryPath, sourcesData) {
  const absoluteEntryPath = path.join(repoRoot, entryPath);
  const entryContent = fs.readFileSync(absoluteEntryPath, "utf8");

  const bundled = entryContent
    .replace(/^[ \t]*\/\/ @bundle-inline (.+)$/gm, (_, relativePath) => {
      const inlinePath = path.resolve(path.dirname(absoluteEntryPath), relativePath.trim());
      return sanitizeInlinedModule(fs.readFileSync(inlinePath, "utf8"));
    })
    .replace("__SOURCES_DATA__", JSON.stringify(sourcesData, null, 2));

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

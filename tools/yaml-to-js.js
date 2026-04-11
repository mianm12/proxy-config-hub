import path from "node:path";
import { promises as fs } from "node:fs";
import yaml from "js-yaml";

const INPUT_DIR = path.resolve("rules");
const OUTPUT_DIR = path.resolve("scripts/config/rules");

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    if (entry.isFile() && /\.(ya?ml)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function convertOne(inputFile) {
  const relativePath = path.relative(INPUT_DIR, inputFile);
  const outputFile = path.join(
    OUTPUT_DIR,
    relativePath.replace(/\.(ya?ml)$/i, ".js")
  );

  const text = await fs.readFile(inputFile, "utf8");
  const data = yaml.load(text);

  await fs.mkdir(path.dirname(outputFile), { recursive: true });

  const js = `export default ${JSON.stringify(data, null, 2)};\n`;
  await fs.writeFile(outputFile, js, "utf8");

  console.log(`Converted: ${relativePath} -> ${path.relative(process.cwd(), outputFile)}`);
}

async function main() {
  const files = await walk(INPUT_DIR);

  if (files.length === 0) {
    console.log("No YAML files found under rules/");
    return;
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const file of files) {
    await convertOne(file);
  }

  console.log(`Done. Converted ${files.length} file(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

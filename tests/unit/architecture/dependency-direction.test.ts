import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function typeScriptFiles(directory: string): readonly string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry): readonly string[] => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? typeScriptFiles(file) : entry.name.endsWith(".ts") ? [file] : [];
  });
}

describe("架构依赖方向", () => {
  it("domain 不反向依赖 compiler、apps、tools 或 Node API", () => {
    const domainRoot = path.resolve(process.cwd(), "src/domain");
    const violations = typeScriptFiles(domainRoot).flatMap((file) => {
      const source = fs.readFileSync(file, "utf8");
      return source
        .split("\n")
        .filter((line) => /from\s+["'].*(?:compiler|apps|tools)|from\s+["']node:/.test(line))
        .map((line) => `${path.relative(process.cwd(), file)}: ${line.trim()}`);
    });

    expect(violations).toEqual([]);
  });

  it("runtime 只以类型方式消费 Project IR，且不依赖 Node、apps 或 tools", () => {
    const runtimeRoot = path.resolve(process.cwd(), "src/runtime");
    const violations = typeScriptFiles(runtimeRoot).flatMap((file) => {
      const source = fs.readFileSync(file, "utf8");
      return source
        .split("\n")
        .filter((line) => {
          if (!/\bfrom\s+["']/.test(line)) return false;
          if (/from\s+["']node:|from\s+["'].*(?:apps|tools)/.test(line)) return true;
          if (!/from\s+["'].*compiler/.test(line)) return false;
          return !/^import\s+type\b.*from\s+["'].*compiler\/ir\/project-ir\.ts["'];?$/.test(
            line.trim(),
          );
        })
        .map((line) => `${path.relative(process.cwd(), file)}: ${line.trim()}`);
    });

    expect(violations).toEqual([]);
  });

  it("override 与 rename app 不互相依赖", () => {
    const appsRoot = path.resolve(process.cwd(), "src/apps");
    const violations = typeScriptFiles(appsRoot).flatMap((file) => {
      const relative = path.relative(appsRoot, file);
      const sibling = relative.startsWith(`override${path.sep}`) ? "rename" : "override";
      return fs
        .readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => new RegExp(`from\\s+["'][^"']*(?:apps/)?${sibling}(?:/|["'])`).test(line))
        .map((line) => `${path.relative(process.cwd(), file)}: ${line.trim()}`);
    });

    expect(violations).toEqual([]);
  });
});

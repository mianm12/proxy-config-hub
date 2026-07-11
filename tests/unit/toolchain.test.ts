import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { SCHEMA_VERSION } from "../../src/version.ts";

describe("v2 工具链", () => {
  it("使用已确认的 schema 版本", () => {
    expect(SCHEMA_VERSION).toBe(2);
  });

  it("默认命令只指向当前 TypeScript 工具链", () => {
    const packageMetadata = z
      .object({ scripts: z.record(z.string(), z.string()) })
      .parse(JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8")) as unknown);

    expect(packageMetadata.scripts).toMatchObject({
      build: "node src/tools/build.ts",
      test: "vitest run",
      check: "node src/tools/check.ts",
      "config:check": "node src/tools/compile-config.ts",
      "verify:golden": "node src/tools/verify-golden.ts",
    });
    expect(Object.keys(packageMetadata.scripts).some((name) => name.includes(":v2"))).toBe(false);
    expect(Object.keys(packageMetadata.scripts).some((name) => name.includes("v1"))).toBe(false);
  });

  it("v1 可执行链已删除且发布规则来自 public", () => {
    for (const removed of ["build.js", "definitions", "scripts", "tools"]) {
      expect(fs.existsSync(path.resolve(removed)), removed).toBe(false);
    }
    expect(fs.existsSync(path.resolve("public/rules/_template.yaml"))).toBe(true);
  });
});

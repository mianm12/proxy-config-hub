import fs from "node:fs";
import vm from "node:vm";

import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { buildV2 } from "../../src/build/build-v2.ts";
import { RENAME_BUNDLE, REPO_ROOT } from "../../src/build/paths.ts";

const fixtureSchema = z.object({
  arguments: z.record(z.string(), z.unknown()),
  proxies: z.array(z.looseObject({ name: z.unknown() })),
});
const goldenSchema = z.object({
  proxies: z.array(z.looseObject({ name: z.string() })),
});

type Operator = (
  proxies: readonly Readonly<Record<string, unknown>>[],
  targetPlatform?: unknown,
  context?: unknown,
) => Promise<readonly Readonly<Record<string, unknown>>[]>;

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

function loadOperator(argumentsValue: Readonly<Record<string, unknown>>): {
  readonly operator: Operator;
  readonly logs: string[];
} {
  const logs: string[] = [];
  const context: Record<string, unknown> = {
    $arguments: argumentsValue,
    console: {
      log: (...values: unknown[]) => logs.push(values.map(String).join(" ")),
      warn: (...values: unknown[]) => logs.push(values.map(String).join(" ")),
      error: (...values: unknown[]) => logs.push(values.map(String).join(" ")),
    },
  };
  context["globalThis"] = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(RENAME_BUNDLE, "utf8"), context, {
    filename: RENAME_BUNDLE,
  });

  const operator = context["operator"];
  if (typeof operator !== "function") throw new Error("rename bundle 未暴露 operator");
  return { operator: operator as Operator, logs };
}

describe("Sub-Store rename bundle", () => {
  beforeAll(async () => buildV2());

  for (const fixtureName of ["rename-pokemon", "rename-self-hosted"] as const) {
    it(`${fixtureName} legacy 参数契约与 v1 golden 等价`, async () => {
      const fixture = fixtureSchema.parse(
        readJson(`${REPO_ROOT}/tests/fixtures/v1-input/rename/${fixtureName}.json`),
      );
      const golden = goldenSchema.parse(
        readJson(`${REPO_ROOT}/tests/golden/v1-rename/${fixtureName}.json`),
      );
      const runtime = loadOperator(fixture.arguments);
      const result = await runtime.operator(structuredClone(fixture.proxies), "ClashMeta", {});

      expect(JSON.parse(JSON.stringify(result)) as unknown).toEqual(golden.proxies);
      expect(runtime.logs.some((line) => line.includes("RENAME_UNKNOWN_REGION"))).toBe(true);
    });
  }

  it("支持命名 profile 主接口", async () => {
    const fixture = fixtureSchema.parse(
      readJson(`${REPO_ROOT}/tests/fixtures/v1-input/rename/rename-pokemon.json`),
    );
    const golden = goldenSchema.parse(
      readJson(`${REPO_ROOT}/tests/golden/v1-rename/rename-pokemon.json`),
    );
    const runtime = loadOperator({ profile: "pokemon" });

    expect(
      JSON.parse(
        JSON.stringify(await runtime.operator(structuredClone(fixture.proxies), "ClashMeta", {})),
      ) as unknown,
    ).toEqual(golden.proxies);
  });

  it("产物不包含构建期依赖、Node API、绝对路径或额外文件", () => {
    const bundle = fs.readFileSync(RENAME_BUNDLE, "utf8");

    expect(bundle).not.toContain("node:fs");
    expect(bundle).not.toContain("node:path");
    expect(bundle).not.toContain("parseDocument");
    expect(bundle).not.toContain("ZodError");
    expect(bundle).not.toContain(".at(");
    expect(bundle).not.toContain('"mixed-port"');
    expect(bundle).not.toContain('"rule-providers"');
    expect(bundle).not.toContain(REPO_ROOT);
    expect(fs.readdirSync(`${REPO_ROOT}/dist/v2`).sort()).toEqual(["override.js", "rename.js"]);
  });
});

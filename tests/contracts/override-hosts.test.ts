import fs from "node:fs";
import vm from "node:vm";

import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { buildBundles } from "../../src/build/build-bundles.ts";
import { OVERRIDE_BUNDLE, REPO_ROOT } from "../../src/build/paths.ts";

const fixtureSchema = z.object({
  cases: z.array(z.object({ name: z.string(), config: z.looseObject({}) })),
});
const goldenSchema = z.object({
  cases: z.array(z.object({ name: z.string(), config: z.looseObject({}) })),
});

type Main = (config: unknown, profileName?: string) => Readonly<Record<string, unknown>>;

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

function loadMain(): {
  readonly globalMain: Main;
  readonly commonJsMain: Main;
  readonly logs: readonly string[];
} {
  const logs: string[] = [];
  const moduleValue: { exports: Record<string, unknown> } = { exports: {} };
  const context: Record<string, unknown> = {
    module: moduleValue,
    console: {
      log: (...values: unknown[]) => logs.push(values.map(String).join(" ")),
      warn: (...values: unknown[]) => logs.push(values.map(String).join(" ")),
      error: (...values: unknown[]) => logs.push(values.map(String).join(" ")),
    },
  };
  context["globalThis"] = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(OVERRIDE_BUNDLE, "utf8"), context, {
    filename: OVERRIDE_BUNDLE,
  });

  const globalMain = context["main"];
  const commonJsMain = moduleValue.exports["main"];
  if (typeof globalMain !== "function") throw new Error("override bundle 未暴露 global main");
  if (typeof commonJsMain !== "function") throw new Error("override bundle 未暴露 CommonJS main");
  return { globalMain: globalMain as Main, commonJsMain: commonJsMain as Main, logs };
}

function normalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

describe("override 三宿主契约", () => {
  beforeAll(async () => buildBundles());

  const fixture = fixtureSchema.parse(
    readJson(`${REPO_ROOT}/tests/fixtures/override/chain-effective.json`),
  );
  const golden = goldenSchema.parse(
    readJson(`${REPO_ROOT}/tests/expected/override/chain-effective.json`),
  );
  const input = fixture.cases[0]?.config;
  const expected = golden.cases[0]?.config;

  it("Mihomo Party 使用 main(config)", () => {
    const runtime = loadMain();
    expect(normalize(runtime.globalMain(structuredClone(input)))).toEqual(expected);
    expect(runtime.logs).toEqual([]);
  });

  it("Clash Verge Rev 使用 main(config, profileName)", () => {
    const runtime = loadMain();
    expect(normalize(runtime.globalMain(structuredClone(input), "个人配置"))).toEqual(expected);
    expect(runtime.logs).toEqual([]);
  });

  it("global main 与 CommonJS bridge 输出一致", () => {
    const runtime = loadMain();
    expect(normalize(runtime.globalMain(structuredClone(input)))).toEqual(expected);
    expect(normalize(runtime.commonJsMain(structuredClone(input)))).toEqual(expected);
    expect(runtime.logs).toEqual([]);
  });

  it("产物不包含构建期依赖、Node API、绝对路径或 secret", () => {
    const bundle = fs.readFileSync(OVERRIDE_BUNDLE, "utf8");

    expect(bundle).not.toContain("node:fs");
    expect(bundle).not.toContain("node:path");
    expect(bundle).not.toContain("parseDocument");
    expect(bundle).not.toContain("ZodError");
    expect(bundle).not.toContain(".at(");
    expect(bundle).not.toContain('"airport"');
    expect(bundle).not.toContain(REPO_ROOT);
    expect(bundle).not.toMatch(/(?:password|token|private-key)\s*[:=]\s*["'][^"']+/i);
    expect(fs.readdirSync(`${REPO_ROOT}/dist/v2`).sort()).toEqual(["override.js", "rename.js"]);
  });
});

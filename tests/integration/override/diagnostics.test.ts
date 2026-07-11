import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { compileProject } from "../../../src/compiler/compile-project.ts";
import { compileOverride } from "../../../src/runtime/override/index.ts";

const fixtureSchema = z.object({
  cases: z.array(z.object({ config: z.looseObject({}) })).min(1),
});

function fixtureInput(name: string): Readonly<Record<string, unknown>> {
  const fixture = fixtureSchema.parse(
    JSON.parse(
      fs.readFileSync(
        path.resolve(process.cwd(), `tests/fixtures/v1-input/override/${name}.json`),
        "utf8",
      ),
    ) as unknown,
  );
  const input = fixture.cases[0]?.config;
  if (input === undefined) throw new Error(`${name} fixture 缺少输入`);
  return input;
}

describe("override 稳定诊断代码", () => {
  const project = compileProject(path.resolve(process.cwd(), "config"));

  it("空节点保持迁移期部分配置语义并报告 error", () => {
    const result = compileOverride(fixtureInput("invalid-names"), project);

    expect(result.diagnostics.map(({ code, severity }) => ({ code, severity }))).toEqual([
      { code: "OVERRIDE_NO_PROXIES", severity: "error" },
      { code: "OVERRIDE_PARTIAL_CONFIG", severity: "warning" },
    ]);
  });

  it("缺少落地时链路退化", () => {
    expect(
      compileOverride(fixtureInput("chain-no-landing"), project).diagnostics.map(
        ({ code }) => code,
      ),
    ).toEqual(["OVERRIDE_CHAIN_NO_LANDING"]);
  });

  it("缺少中转时链路退化", () => {
    expect(
      compileOverride(fixtureInput("chain-no-transit"), project).diagnostics.map(
        ({ code }) => code,
      ),
    ).toEqual(["OVERRIDE_CHAIN_NO_TRANSIT"]);
  });

  it("已有 dialer-proxy 保留并报告 warning", () => {
    expect(
      compileOverride(fixtureInput("existing-dialer"), project).diagnostics.map(({ code }) => code),
    ).toEqual(["OVERRIDE_DIALER_PRESERVED"]);
  });
});

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { parse } from "yaml";
import { z } from "zod";

import { runRenameAdapter } from "../apps/rename/adapter.ts";
import { compileProject } from "../compiler/compile-project.ts";
import { compileOverride } from "../runtime/override/index.ts";
import { CONFIG_ROOT, REPO_ROOT } from "../build/paths.ts";

const looseConfigSchema = z.looseObject({ proxies: z.array(z.unknown()) });
const overrideFixtureSchema = z.object({
  cases: z.array(
    z.object({
      name: z.string(),
      config: looseConfigSchema.optional(),
      template: z.boolean().optional(),
    }),
  ),
});
const overrideGoldenSchema = z.object({
  cases: z.array(z.object({ name: z.string(), config: z.looseObject({}) })),
});
const renameFixtureSchema = z.object({
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()),
  targetPlatform: z.unknown().optional(),
  context: z.unknown().optional(),
  proxies: z.array(z.looseObject({ name: z.unknown() })),
});
const renameGoldenSchema = z.object({
  fixture: z.string(),
  proxies: z.array(z.looseObject({ name: z.string() })),
});

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

function jsonFiles(directory: string): readonly string[] {
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort();
}

function templateProxyInput(): z.infer<typeof looseConfigSchema> {
  const template = looseConfigSchema.parse(
    parse(fs.readFileSync(path.join(REPO_ROOT, "templates/mihomo/config-example.yaml"), "utf8")),
  );
  return { proxies: template.proxies };
}

function compareOverride(project: ReturnType<typeof compileProject>): number {
  const fixtureRoot = path.join(REPO_ROOT, "tests/fixtures/v1-input/override");
  const goldenRoot = path.join(REPO_ROOT, "tests/golden/v1-output");
  let compared = 0;

  for (const file of jsonFiles(fixtureRoot)) {
    const fixture = overrideFixtureSchema.parse(readJson(path.join(fixtureRoot, file)));
    const golden = overrideGoldenSchema.parse(readJson(path.join(goldenRoot, file)));
    assert.equal(fixture.cases.length, golden.cases.length, `${file} case 数量不一致`);

    fixture.cases.forEach((fixtureCase, index) => {
      const goldenCase = golden.cases[index];
      assert.ok(goldenCase, `${file} 缺少第 ${String(index + 1)} 个 golden case`);
      assert.equal(fixtureCase.name, goldenCase.name, `${file} case 名称不一致`);
      const input = fixtureCase.template === true ? templateProxyInput() : fixtureCase.config;
      assert.ok(input, `${file}/${fixtureCase.name} 缺少输入配置`);
      const inputSnapshot = structuredClone(input);
      const output = compileOverride(input, project).config;

      assert.deepStrictEqual(input, inputSnapshot, `${file}/${fixtureCase.name} 修改了输入`);
      assert.deepStrictEqual(output, goldenCase.config, `${file}/${fixtureCase.name} 输出不等价`);
      compared += 1;
    });
  }

  return compared;
}

function compareRename(project: ReturnType<typeof compileProject>): number {
  const fixtureRoot = path.join(REPO_ROOT, "tests/fixtures/v1-input/rename");
  const goldenRoot = path.join(REPO_ROOT, "tests/golden/v1-rename");
  let compared = 0;

  for (const file of jsonFiles(fixtureRoot)) {
    const fixture = renameFixtureSchema.parse(readJson(path.join(fixtureRoot, file)));
    const golden = renameGoldenSchema.parse(readJson(path.join(goldenRoot, file)));
    const inputSnapshot = structuredClone(fixture.proxies);
    const output = runRenameAdapter(
      fixture.proxies,
      fixture.targetPlatform,
      fixture.context,
      fixture.arguments,
      { nodeCatalog: project.nodeCatalog, renameProfiles: project.renameProfiles },
    );

    assert.equal(golden.fixture, fixture.name, `${file} fixture 名称不一致`);
    assert.deepStrictEqual(fixture.proxies, inputSnapshot, `${file} 修改了输入`);
    assert.deepStrictEqual(output, golden.proxies, `${file} 输出不等价`);
    compared += 1;
  }

  return compared;
}

const project = compileProject(CONFIG_ROOT);
const overrideCount = compareOverride(project);
const renameCount = compareRename(project);
console.log(
  `历史 golden 结构化回归通过：override ${String(overrideCount)} cases，rename ${String(renameCount)} cases`,
);

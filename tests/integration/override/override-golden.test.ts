import fs from "node:fs";
import path from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { compileProject } from "../../../src/compiler/compile-project.ts";
import { compileOverride } from "../../../src/runtime/override/index.ts";

const configSchema = z.looseObject({ proxies: z.array(z.unknown()) });
const fixtureSchema = z.object({
  cases: z.array(
    z.object({
      name: z.string(),
      config: configSchema.optional(),
      template: z.boolean().optional(),
    }),
  ),
});
const goldenSchema = z.object({
  fixture: z.string(),
  cases: z.array(
    z.object({
      name: z.string(),
      config: z.looseObject({}),
      logs: z.array(z.unknown()),
    }),
  ),
});

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

function loadTemplateConfig(): z.infer<typeof configSchema> {
  const template = configSchema.parse(
    parse(
      fs.readFileSync(
        path.resolve(process.cwd(), "tests/fixtures/override/full-example-input.yaml"),
        "utf8",
      ),
    ),
  );
  return { proxies: template.proxies };
}

describe("override 行为回归", () => {
  const project = compileProject(path.resolve(process.cwd(), "config"));
  const fixtureRoot = path.resolve(process.cwd(), "tests/fixtures/override");
  const expectedRoot = path.resolve(process.cwd(), "tests/expected/override");
  const expectedNames = fs
    .readdirSync(expectedRoot)
    .filter((name) => name.endsWith(".json"))
    .sort();

  for (const fixtureFile of expectedNames) {
    const fixtureId = path.basename(fixtureFile, ".json");
    const fixture = fixtureSchema.parse(readJson(path.join(fixtureRoot, fixtureFile)));
    const golden = goldenSchema.parse(readJson(path.join(expectedRoot, fixtureFile)));

    it(`${fixtureId} 生成审阅后的预期配置`, () => {
      expect(golden.fixture).toBe(fixtureId);
      expect(fixture.cases).toHaveLength(golden.cases.length);

      fixture.cases.forEach((fixtureCase, index) => {
        const goldenCase = golden.cases[index];
        const input = fixtureCase.template === true ? loadTemplateConfig() : fixtureCase.config;
        expect(input, `${fixtureCase.name} 缺少输入配置`).toBeDefined();
        expect(goldenCase?.name).toBe(fixtureCase.name);

        const inputSnapshot = structuredClone(input);
        const result = compileOverride(input, project);

        expect(input).toEqual(inputSnapshot);
        expect(result.config["ipv6"]).toBe(false);
        expect(result.config["geox-url"]).toEqual({
          geoip: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat",
          geosite: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat",
          mmdb: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb",
          asn: "https://github.com/xishang0128/geoip/releases/download/latest/GeoLite2-ASN.mmdb",
        });
        const providers = z
          .record(z.string(), z.looseObject({ url: z.string() }))
          .parse(result.config["rule-providers"]);
        expect(Object.keys(providers)).toHaveLength(93);
        for (const provider of Object.values(providers)) {
          expect(new URL(provider.url).origin).toBe("https://cdn.jsdelivr.net");
        }
        expect(result.config).toEqual(goldenCase?.config);
      });
    });
  }
});

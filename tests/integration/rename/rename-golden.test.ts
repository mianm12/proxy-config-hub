import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { runRenameAdapter } from "../../../src/apps/rename/adapter.ts";
import { compileProject } from "../../../src/compiler/compile-project.ts";

const fixtureSchema = z.object({
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()),
  proxies: z.array(z.looseObject({ name: z.unknown() })),
});
const goldenSchema = z.object({
  fixture: z.string(),
  proxies: z.array(z.looseObject({ name: z.string() })),
});

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

describe("rename 行为回归", () => {
  const project = compileProject(path.resolve(process.cwd(), "config"));

  for (const profileId of ["pokemon", "self_hosted"] as const) {
    it(`${profileId} 生成审阅后的预期名称`, () => {
      const fixtureName = profileId === "pokemon" ? "rename-pokemon" : "rename-self-hosted";
      const fixture = fixtureSchema.parse(
        readJson(path.resolve(process.cwd(), `tests/fixtures/rename/${fixtureName}.json`)),
      );
      const golden = goldenSchema.parse(
        readJson(path.resolve(process.cwd(), `tests/expected/rename/${fixtureName}.json`)),
      );
      const inputSnapshot = structuredClone(fixture.proxies);
      const runtime = {
        nodeCatalog: project.nodeCatalog,
        renameProfiles: project.renameProfiles,
      };
      const diagnostics: string[] = [];
      const result = runRenameAdapter(
        fixture.proxies,
        "ClashMeta",
        {},
        fixture.arguments,
        runtime,
        ({ code }) => diagnostics.push(code),
      );

      expect(fixture.proxies).toEqual(inputSnapshot);
      expect(result).toEqual(golden.proxies);
      expect(diagnostics).toContain("RENAME_UNKNOWN_REGION");
    });
  }
});

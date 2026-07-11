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

describe("rename v1 golden", () => {
  const project = compileProject(path.resolve(process.cwd(), "config"));

  for (const profileId of ["pokemon", "self_hosted"] as const) {
    it(`${profileId} 与实际 legacy 参数结果等价`, () => {
      const fixtureName = profileId === "pokemon" ? "rename-pokemon" : "rename-self-hosted";
      const fixture = fixtureSchema.parse(
        readJson(path.resolve(process.cwd(), `tests/fixtures/v1-input/rename/${fixtureName}.json`)),
      );
      const golden = goldenSchema.parse(
        readJson(path.resolve(process.cwd(), `tests/golden/v1-rename/${fixtureName}.json`)),
      );
      const inputSnapshot = structuredClone(fixture.proxies);
      const runtime = {
        nodeCatalog: project.nodeCatalog,
        renameProfiles: project.renameProfiles,
      };
      const legacyDiagnostics: string[] = [];
      const namedDiagnostics: string[] = [];
      const legacyResult = runRenameAdapter(
        fixture.proxies,
        "ClashMeta",
        {},
        fixture.arguments,
        runtime,
        ({ code }) => legacyDiagnostics.push(code),
      );
      const namedResult = runRenameAdapter(
        fixture.proxies,
        "ClashMeta",
        {},
        { profile: profileId },
        runtime,
        ({ code }) => namedDiagnostics.push(code),
      );

      expect(fixture.proxies).toEqual(inputSnapshot);
      expect(legacyResult).toEqual(golden.proxies);
      expect(namedResult).toEqual(golden.proxies);
      expect(legacyDiagnostics).toContain("RENAME_UNKNOWN_REGION");
      expect(namedDiagnostics).toContain("RENAME_UNKNOWN_REGION");
    });
  }
});

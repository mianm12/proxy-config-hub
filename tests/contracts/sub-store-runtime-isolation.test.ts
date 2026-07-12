import fs from "node:fs";
import vm from "node:vm";

import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { buildBundles } from "../../src/build/build-bundles.ts";
import { OVERRIDE_BUNDLE, RENAME_BUNDLE, REPO_ROOT } from "../../src/build/paths.ts";

const fixtureSchema = z.object({
  cases: z.array(z.object({ name: z.string(), config: z.looseObject({}) })),
});
const goldenSchema = z.object({
  cases: z.array(z.object({ name: z.string(), config: z.looseObject({}) })),
});

interface FileEnvelope {
  readonly $content: string;
  readonly $file: { readonly type: string };
}

type FileOperator = (input: FileEnvelope) => Promise<FileEnvelope>;

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

function normalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

describe("Sub-Store 共享运行时隔离", () => {
  beforeAll(async () => buildBundles());

  it("先加载 rename 后仍通过局部 main 正确覆写文件", async () => {
    const logs: string[] = [];
    const context: Record<string, unknown> = {
      injectedArguments: {},
      injectedProxyUtils: {
        yaml: {
          safeLoad: (value: string) => JSON.parse(value) as unknown,
          safeDump: (value: unknown) => JSON.stringify(value),
        },
      },
      injectedSubStore: {},
      console: {
        log: (...values: unknown[]) => logs.push(values.map(String).join(" ")),
        warn: (...values: unknown[]) => logs.push(values.map(String).join(" ")),
        error: (...values: unknown[]) => logs.push(values.map(String).join(" ")),
      },
    };
    vm.createContext(context);

    const renameBundle = fs.readFileSync(RENAME_BUNDLE, "utf8");
    const renameOperator = vm.runInContext(
      `(function ($arguments, ProxyUtils, $substore) {\n${renameBundle}\nreturn operator;\n})(injectedArguments, injectedProxyUtils, injectedSubStore)`,
      context,
      { filename: RENAME_BUNDLE },
    ) as unknown;

    expect(renameOperator).toBeTypeOf("function");
    expect(context["operator"]).toBeUndefined();

    const overrideBundle = fs.readFileSync(OVERRIDE_BUNDLE, "utf8");
    const fileOperator = vm.runInContext(
      `(function ($substore, ProxyUtils) {
        async function operator(input = {}) {
          let { $content, $files, $options, $file } = input;
          if (["mihomoConfig", "mihomoProfile"].includes($file?.type)) {
            ${overrideBundle}
            if (typeof main === "function") {
              const config = ProxyUtils.yaml.safeLoad($content);
              $content = ProxyUtils.yaml.safeDump(await main(config || {}));
            }
          }
          return { $content, $files, $options, $file };
        }
        return operator;
      })(injectedSubStore, injectedProxyUtils)`,
      context,
      { filename: OVERRIDE_BUNDLE },
    ) as FileOperator;

    const fixture = fixtureSchema.parse(
      readJson(`${REPO_ROOT}/tests/fixtures/override/chain-effective.json`),
    );
    const golden = goldenSchema.parse(
      readJson(`${REPO_ROOT}/tests/expected/override/chain-effective.json`),
    );
    const result = await fileOperator({
      $content: JSON.stringify(fixture.cases[0]?.config),
      $file: { type: "mihomoConfig" },
    });

    expect(normalize(JSON.parse(result.$content) as unknown)).toEqual(golden.cases[0]?.config);
    expect(context["main"]).toBeUndefined();
    expect(context["operator"]).toBeUndefined();
    expect(logs).toEqual([]);
  });
});

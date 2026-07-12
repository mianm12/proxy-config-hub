import fs from "node:fs";
import vm from "node:vm";

import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { buildBundles } from "../../src/build/build-bundles.ts";
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

function loadOperator(
  argumentsValue: Readonly<Record<string, unknown>>,
  getISO?: (name: string) => unknown,
): {
  readonly operator: Operator;
  readonly logs: string[];
} {
  const logs: string[] = [];
  const context: Record<string, unknown> = {
    injectedArguments: argumentsValue,
    injectedProxyUtils: getISO === undefined ? undefined : { getISO },
    console: {
      log: (...values: unknown[]) => logs.push(values.map(String).join(" ")),
      warn: (...values: unknown[]) => logs.push(values.map(String).join(" ")),
      error: (...values: unknown[]) => logs.push(values.map(String).join(" ")),
    },
  };
  vm.createContext(context);
  const bundle = fs.readFileSync(RENAME_BUNDLE, "utf8");
  const operator = vm.runInContext(
    `(function ($arguments, ProxyUtils) {\n${bundle}\nreturn globalThis.operator;\n})(injectedArguments, injectedProxyUtils)`,
    context,
    { filename: RENAME_BUNDLE },
  ) as unknown;

  if (typeof operator !== "function") throw new Error("rename bundle 未暴露 operator");
  return { operator: operator as Operator, logs };
}

describe("Sub-Store rename bundle", () => {
  beforeAll(async () => buildBundles());

  for (const fixtureName of ["rename-airport", "rename-self-hosted"] as const) {
    it(`${fixtureName} 命名 profile 契约符合预期`, async () => {
      const fixture = fixtureSchema.parse(
        readJson(`${REPO_ROOT}/tests/fixtures/rename/${fixtureName}.json`),
      );
      const golden = goldenSchema.parse(
        readJson(`${REPO_ROOT}/tests/expected/rename/${fixtureName}.json`),
      );
      const runtime = loadOperator(fixture.arguments);
      const result = await runtime.operator(structuredClone(fixture.proxies), "ClashMeta", {});

      expect(JSON.parse(JSON.stringify(result)) as unknown).toEqual(golden.proxies);
      expect(runtime.logs.some((line) => line.includes("RENAME_UNKNOWN_REGION"))).toBe(true);
    });
  }

  it("支持命名 profile 主接口", async () => {
    const fixture = fixtureSchema.parse(
      readJson(`${REPO_ROOT}/tests/fixtures/rename/rename-airport.json`),
    );
    const golden = goldenSchema.parse(
      readJson(`${REPO_ROOT}/tests/expected/rename/rename-airport.json`),
    );
    const runtime = loadOperator({ profile: "airport" });

    expect(
      JSON.parse(
        JSON.stringify(await runtime.operator(structuredClone(fixture.proxies), "ClashMeta", {})),
      ) as unknown,
    ).toEqual(golden.proxies);
  });

  it("无 profile 时使用 standard 默认配置并支持参数覆盖", async () => {
    const runtime = loadOperator({
      fields: "subscription,iso,protocol,sequence",
      separator: "-",
      brackets: "protocol",
    });
    const result = await runtime.operator(
      [{ name: "香港", type: "VLESS", _subDisplayName: "显示名" }],
      "ClashMeta",
      {},
    );

    expect(result.map(({ name }) => name)).toEqual(["显示名-HK-[vless]-01"]);
  });

  it("命名 profile 在宿主 bundle 中跳过订阅流量信息", async () => {
    const runtime = loadOperator({ profile: "airport" });
    const result = await runtime.operator(
      [
        { name: "剩余流量：4.26 GB", type: "trojan" },
        {
          name: "🇭🇰【亚洲】香港01丨直连",
          type: "hysteria2",
          _subDisplayName: "示例机场",
        },
        {
          name: "🇭🇰【亚洲】香港02丨直连",
          type: "hysteria2",
          _subDisplayName: "示例机场",
        },
      ],
      "ClashMeta",
      {},
    );

    expect(result.map(({ name }) => name)).toEqual([
      "[示例机场] 🇭🇰 HK [hysteria2] 直连 01",
      "[示例机场] 🇭🇰 HK [hysteria2] 直连 02",
    ]);
    expect(runtime.logs.some((line) => line.includes("RENAME_SUBSCRIPTION_METADATA_SKIPPED"))).toBe(
      true,
    );
  });

  it("通用机场 profile 在订阅名无效时使用参数 fallback", async () => {
    const runtime = loadOperator({
      profile: "airport",
      subscriptionFallback: "手动机场",
    });
    const result = await runtime.operator(
      [{ name: "香港 IPLC 3x", type: "trojan", _subDisplayName: "   " }],
      "ClashMeta",
      {},
    );

    expect(result.map(({ name }) => name)).toEqual(["[手动机场] 🇭🇰 HK [trojan] IPLC 3× 01"]);
    expect(runtime.logs.some((line) => line.includes("RENAME_SUBSCRIPTION_NAME_MISSING"))).toBe(
      false,
    );
  });

  it("优先使用宿主 ProxyUtils 识别 catalog 外地区并规范旗帜", async () => {
    const runtime = loadOperator({}, (name) => (name.includes("柬埔寨") ? "KH" : undefined));
    const result = await runtime.operator(
      [{ name: "🇨🇳 柬埔寨 01", type: "trojan", _subName: "订阅" }],
      "ClashMeta",
      {},
    );

    expect(result.map(({ name }) => name)).toEqual(["[订阅] 🇰🇭 KH [trojan] 01"]);
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

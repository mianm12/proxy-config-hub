import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { compileProject } from "../../../src/compiler/compile-project.ts";
import { ConfigCompilationError } from "../../../src/domain/diagnostics/diagnostic.ts";
import { compileOverride } from "../../../src/runtime/override/index.ts";

const fixtureSchema = z.object({
  cases: z.array(z.object({ name: z.string(), config: z.looseObject({}) })).min(1),
});

function fixtureInput(file: string, caseName?: string): Readonly<Record<string, unknown>> {
  const fixture = fixtureSchema.parse(
    JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), `tests/fixtures/override/${file}.json`), "utf8"),
    ) as unknown,
  );
  const input =
    caseName === undefined
      ? fixture.cases[0]?.config
      : fixture.cases.find(({ name }) => name === caseName)?.config;
  if (input === undefined) throw new Error(`${file}/${caseName ?? "<first>"} fixture 缺少输入`);
  return input;
}

function expectNoProxyError(input: Readonly<Record<string, unknown>>): void {
  try {
    compileOverride(input, compileProject(path.resolve(process.cwd(), "config")));
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigCompilationError);
    if (!(error instanceof ConfigCompilationError)) return;
    expect(error.diagnostics).toEqual([
      {
        code: "OVERRIDE_NO_PROXIES",
        severity: "error",
        message: "config.proxies 为空，无法生成策略组和分流规则",
      },
    ]);
    return;
  }
  throw new Error("预期空代理输入抛出 ConfigCompilationError");
}

describe("override 稳定诊断代码", () => {
  const project = compileProject(path.resolve(process.cwd(), "config"));

  it("空代理与全部无效名称均直接失败", () => {
    expectNoProxyError(fixtureInput("invalid-names", "空代理数组"));
    expectNoProxyError(fixtureInput("invalid-names", "全部节点名无效"));
  });

  it("有效与无效名称混合时仅把有效名称加入策略组", () => {
    const result = compileOverride(fixtureInput("invalid-names", "有效与无效节点名混合"), project);
    const groups = z
      .array(z.looseObject({ name: z.string(), proxies: z.array(z.string()) }))
      .parse(result.config["proxy-groups"]);

    expect(groups.find(({ name }) => name === "🔧 手动选择")?.proxies).toEqual(["香港-Valid-01"]);
  });

  it("缺少落地时链路退化", () => {
    expect(
      compileOverride(fixtureInput("chain-no-landing"), project).diagnostics.map(
        ({ code }) => code,
      ),
    ).toEqual(["OVERRIDE_CHAIN_NO_LANDING"]);
  });

  it("缺少中转时链路退化并将落地节点恢复到普通池", () => {
    const result = compileOverride(fixtureInput("chain-no-transit"), project);
    const groups = z
      .array(z.looseObject({ name: z.string(), proxies: z.array(z.string()) }))
      .parse(result.config["proxy-groups"]);

    expect(result.diagnostics.map(({ code }) => code)).toEqual(["OVERRIDE_CHAIN_NO_TRANSIT"]);
    expect(groups.find(({ name }) => name === "🔧 手动选择")?.proxies).toEqual([
      "Relay-🇺🇸-Landing-01",
      "普通-🇭🇰-01",
    ]);
  });

  it("已有 dialer-proxy 保留并报告 warning", () => {
    expect(
      compileOverride(fixtureInput("existing-dialer"), project).diagnostics.map(({ code }) => code),
    ).toEqual(["OVERRIDE_DIALER_PRESERVED"]);
  });

  it("排除词命中的节点保留在普通池且不进入中转组", () => {
    const [chain, ...otherChains] = project.chains;
    if (chain?.transit.selector.kind !== "keywords") {
      throw new Error("测试配置缺少关键词中转 selector");
    }
    const projectWithExclusion = {
      ...project,
      chains: [
        {
          ...chain,
          transit: {
            ...chain.transit,
            selector: { ...chain.transit.selector, excludeNames: ["XHTTP"] },
          },
        },
        ...otherChains,
      ],
    };
    const result = compileOverride(
      {
        proxies: [
          { name: "Transit-普通-01", type: "socks5" },
          { name: "自建-直连-XHTTP-01", type: "socks5" },
          { name: "Relay-Landing-01", type: "socks5" },
          { name: "普通-香港-01", type: "socks5" },
        ],
      },
      projectWithExclusion,
    );
    const groups = z
      .array(z.looseObject({ name: z.string(), proxies: z.array(z.string()) }))
      .parse(result.config["proxy-groups"]);

    expect(groups.find(({ name }) => name === "🔀 中转")?.proxies).toEqual(["Transit-普通-01"]);
    expect(groups.find(({ name }) => name === "🚪 落地")?.proxies).toEqual(["Relay-Landing-01"]);
    expect(groups.find(({ name }) => name === "🔧 手动选择")?.proxies).toContain(
      "自建-直连-XHTTP-01",
    );
  });
});

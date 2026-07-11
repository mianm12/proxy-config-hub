import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { compileProject } from "../../../src/compiler/compile-project.ts";

const inventorySchema = z.object({
  groupOrder: z.array(z.object({ id: z.string(), name: z.string() })),
  providerOrder: z.array(z.string()),
  regionOrder: z.array(z.object({ id: z.string(), name: z.string(), icon: z.string() })),
});
const goldenSchema = z.object({
  cases: z.array(
    z.object({
      config: z.record(z.string(), z.unknown()),
    }),
  ),
});

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

function compileCurrentProject() {
  return compileProject(path.resolve(process.cwd(), "config"));
}

describe("Project IR", () => {
  it("保持 v1 策略组展示顺序、provider 顺序与地区顺序", () => {
    const project = compileCurrentProject();
    const inventory = inventorySchema.parse(
      readJson(path.resolve(process.cwd(), "tests/golden/v1-inventory.json")),
    );
    const golden = goldenSchema.parse(
      readJson(path.resolve(process.cwd(), "tests/golden/v1-output/full-example.json")),
    );
    const goldenGroups = z
      .array(z.looseObject({ name: z.string() }))
      .parse(golden.cases[0]?.config["proxy-groups"]);
    const generatedNames = new Set([
      ...project.routingRegions.map(({ groupName }) => groupName),
      ...project.chains.flatMap(({ transit, landing }) => [transit.groupName, landing.groupName]),
    ]);
    const expectedGroupNames = goldenGroups
      .map(({ name }) => name)
      .filter((name) => !generatedNames.has(name));
    const groupNames = new Map(project.groups.map((group) => [group.id, group.name]));

    expect(
      project.groupLayout
        .filter((item) => item.kind === "group")
        .map((item) => groupNames.get(item.id)),
    ).toEqual(expectedGroupNames);
    expect(new Set(project.groups.map(({ id, name }) => `${id}\0${name}`))).toEqual(
      new Set(inventory.groupOrder.map(({ id, name }) => `${id}\0${name}`)),
    );
    expect(project.providers.map(({ id }) => id)).toEqual(inventory.providerOrder);
    expect(project.routingRegions.map(({ id }) => id)).toEqual(
      inventory.regionOrder.map(({ id }) => id),
    );
  });

  it("展开后的 provider 字段与 v1 完整 golden 等价", () => {
    const project = compileCurrentProject();
    const golden = goldenSchema.parse(
      readJson(path.resolve(process.cwd(), "tests/golden/v1-output/full-example.json")),
    );
    const config = golden.cases[0]?.config;
    expect(config).toBeDefined();
    const expectedProviders = z
      .record(z.string(), z.record(z.string(), z.unknown()))
      .parse(config?.["rule-providers"]);
    const actualProviders = Object.fromEntries(
      project.providers.map((provider) => {
        const { mihomo, ...standard } = provider.config;
        return [provider.id, { ...standard, ...mihomo }];
      }),
    );

    expect(actualProviders).toEqual(expectedProviders);
  });

  it("生成与 v1 相同的 provider 规则和 fallback", () => {
    const project = compileCurrentProject();
    const golden = goldenSchema.parse(
      readJson(path.resolve(process.cwd(), "tests/golden/v1-output/full-example.json")),
    );
    const expectedRules = z.array(z.string()).parse(golden.cases[0]?.config["rules"]);
    const groupNames = new Map(project.groups.map((group) => [group.id, group.name]));
    const actualRules = project.rules.map((rule) => {
      if (rule.kind === "raw") return rule.value;
      const target = groupNames.get(rule.target) ?? rule.target;
      return `RULE-SET,${rule.provider},${target}${rule.noResolve ? ",no-resolve" : ""}`;
    });
    actualRules.push(`MATCH,${groupNames.get(project.fallbackGroup) ?? project.fallbackGroup}`);

    expect(actualRules).toEqual(expectedRules);
  });

  it("保持 v1 runtime preset 的应用数据", () => {
    const project = compileCurrentProject();
    const golden = goldenSchema.parse(
      readJson(path.resolve(process.cwd(), "tests/golden/v1-output/full-example.json")),
    );
    const config = golden.cases[0]?.config;
    expect(config).toBeDefined();
    const plan = new Map(project.runtimePlan.map((item) => [item.target, item]));
    const root = z.record(z.string(), z.unknown()).parse(plan.get("root")?.value);

    for (const [key, value] of Object.entries(root)) {
      expect(config?.[key]).toEqual(value);
    }
    expect(plan.get("dns")?.value).toEqual(config?.["dns"]);
    expect(plan.get("sniffer")?.value).toEqual(config?.["sniffer"]);
    expect(plan.get("tun")?.value).toEqual(config?.["tun"]);
    expect(plan.get("allow-lan")?.value).toEqual(config?.["allow-lan"]);
  });

  it("相同输入重复编译产生等价 IR", () => {
    expect(compileCurrentProject()).toEqual(compileCurrentProject());
  });
});

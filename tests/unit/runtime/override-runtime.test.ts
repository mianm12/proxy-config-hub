import { describe, expect, it } from "vitest";

import type { RuntimeSectionIr } from "../../../src/compiler/ir/project-ir.ts";
import { applyRuntimePlan } from "../../../src/runtime/override/runtime-plan.ts";
import { matchesSelector } from "../../../src/runtime/override/selectors.ts";
import { validateDynamicOutput } from "../../../src/runtime/override/validate-output.ts";

describe("override runtime", () => {
  it("按 overlay、replace、if-absent 语义应用配置且不修改输入", () => {
    const input = { mode: "global", tun: false, dns: { enable: false } };
    const snapshot = structuredClone(input);
    const plan: RuntimeSectionIr[] = [
      { target: "root", apply: "overlay", value: { mode: "rule", mixed: true } },
      { target: "dns", apply: "replace", value: { enable: true } },
      { target: "tun", apply: "if-absent", value: { enable: true } },
      { target: "profile", apply: "if-absent", value: { store: true } },
    ];

    expect(applyRuntimePlan(input, plan)).toEqual({
      mode: "rule",
      mixed: true,
      tun: false,
      dns: { enable: true },
      profile: { store: true },
    });
    expect(input).toEqual(snapshot);
  });

  it("关键词选择器支持 any 和 all，正则选择器保持显式", () => {
    expect(
      matchesSelector("自建-中转-01", {
        kind: "keywords",
        anyName: ["中转", "Transit"],
        allNames: [],
      }),
    ).toBe(true);
    expect(
      matchesSelector("自建-中转-01", {
        kind: "keywords",
        anyName: [],
        allNames: ["自建", "中转"],
      }),
    ).toBe(true);
    expect(
      matchesSelector("自建-中转-01", {
        kind: "keywords",
        anyName: [],
        allNames: ["自建", "落地"],
      }),
    ).toBe(false);
    expect(
      matchesSelector("Relay-Landing-01", { kind: "regex", pattern: "landing", flags: "i" }),
    ).toBe(true);
  });

  it("动态输出拒绝不存在的策略组成员", () => {
    expect(() => {
      validateDynamicOutput(
        [{ name: "代理", type: "select", proxies: ["不存在"] }],
        {},
        ["MATCH,代理"],
        [{ name: "节点", type: "socks5" }],
        "代理",
      );
    }).toThrow("引用了不存在的成员");
  });
});

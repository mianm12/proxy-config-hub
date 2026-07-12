import path from "node:path";

import { describe, expect, it } from "vitest";

import { compileProject } from "../../../src/compiler/compile-project.ts";

function compileCurrentProject() {
  return compileProject(path.resolve(process.cwd(), "config"));
}

describe("Project IR", () => {
  it("生成引用闭合且顺序稳定的运行时模型", () => {
    const project = compileCurrentProject();
    const groupIds = new Set(project.groups.map(({ id }) => id));
    const providerIds = new Set(project.providers.map(({ id }) => id));

    expect(project.groups).toHaveLength(34);
    expect(project.providers).toHaveLength(93);
    expect(project.routingRegions).toHaveLength(28);
    expect(
      project.groupLayout.every((item) => item.kind === "generated" || groupIds.has(item.id)),
    ).toBe(true);
    expect(
      project.rules.every((rule) => rule.kind === "raw" || providerIds.has(rule.provider)),
    ).toBe(true);
    expect(groupIds.has(project.fallbackGroup)).toBe(true);
    expect(project.renameDefaultProfile).toBe("standard");
    expect(project.renameProfiles).toContainEqual({
      id: "self_hosted",
      fields: ["subscription", "flag", "iso", "protocol", "traits", "multiplier", "sequence"],
      separator: " ",
      brackets: ["subscription", "protocol"],
      subscriptionFallback: "自建",
      extraTraits: ["AWS", "BWH", "DMIT", "vircs", "MEGABOX", "proWee", "ebCorona", "down"],
      sequence: "always",
    });
  });

  it("相同输入重复编译产生等价 IR", () => {
    expect(compileCurrentProject()).toEqual(compileCurrentProject());
  });
});

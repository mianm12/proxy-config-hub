import { describe, expect, it } from "vitest";

import type { RegionIr, RenameProfileIr } from "../../../src/compiler/ir/project-ir.ts";
import { renameProxies } from "../../../src/runtime/rename/index.ts";

const HK: RegionIr = {
  id: "HK",
  name: "香港",
  emoji: "🇭🇰",
  codes: ["HK"],
  names: { zh: ["香港"], en: ["Hong Kong"] },
  aliases: [],
  cities: [],
};
const PROFILE: RenameProfileIr = {
  id: "fixture",
  prefix: "节点",
  prefixPosition: "first",
  separator: "-",
  addFlag: true,
  preserveMultiplier: false,
  collapseSingle: true,
  preserveTags: [],
};

describe("renameProxies", () => {
  it("不修改输入并只给同名节点添加序号", () => {
    const input = [
      { name: "香港 A", server: "192.0.2.1" },
      { name: "香港 B", server: "192.0.2.2" },
    ];
    const snapshot = structuredClone(input);
    const result = renameProxies(input, PROFILE, [HK]);

    expect(input).toEqual(snapshot);
    expect(result.proxies.map(({ name }) => name)).toEqual(["节点-🇭🇰-香港 01", "节点-🇭🇰-香港 02"]);
  });

  it("丢弃无效名称和未知地区并给出结构化 warning", () => {
    const result = renameProxies([{ name: "Mars" }, { name: null }], PROFILE, [HK]);

    expect(result.proxies).toEqual([]);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "RENAME_UNKNOWN_REGION",
      "RENAME_INVALID_NAME",
    ]);
  });
});

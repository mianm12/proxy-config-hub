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
const US: RegionIr = {
  id: "US",
  name: "美国",
  emoji: "🇺🇸",
  codes: ["US", "USA"],
  names: { zh: ["美国"], en: ["United States"] },
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
const POKEMON_PROFILE: RenameProfileIr = {
  ...PROFILE,
  id: "pokemon",
  prefix: "宝可梦",
  preserveTags: ["直连"],
};
const SELF_HOSTED_PROFILE: RenameProfileIr = {
  ...PROFILE,
  id: "self_hosted",
  prefix: "自建",
  preserveTags: ["XHTTP", "REALITY", "DMIT", "proWee", "ebCorona"],
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

  it("跳过订阅信息节点并保持真实 Pokemon 节点排序", () => {
    const result = renameProxies(
      [
        { name: "剩余流量：4.26 GB" },
        { name: "🇭🇰【亚洲】香港01丨直连" },
        { name: "🇭🇰【亚洲】香港02丨直连" },
      ],
      POKEMON_PROFILE,
      [HK],
    );

    expect(result.proxies.map(({ name }) => name)).toEqual([
      "宝可梦-🇭🇰-香港-直连 01",
      "宝可梦-🇭🇰-香港-直连 02",
    ]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RENAME_SUBSCRIPTION_METADATA_SKIPPED",
        severity: "warning",
        context: { index: 0, name: "剩余流量：4.26 GB" },
      }),
    );
  });

  it("按 self_hosted profile 保留真实自建节点标签", () => {
    const result = renameProxies(
      [
        { name: "VLESS + REALITY + Vision-US-DMIT-proWee" },
        { name: "VLESS-XHTTP-Reality-US-DMIT-proWee" },
        { name: "VLESS + REALITY + Vision-US-DMIT-ebCorona" },
      ],
      SELF_HOSTED_PROFILE,
      [US],
    );

    expect(result.proxies.map(({ name }) => name)).toEqual([
      "自建-🇺🇸-美国-REALITY-DMIT-proWee",
      "自建-🇺🇸-美国-XHTTP-Reality-DMIT-proWee",
      "自建-🇺🇸-美国-REALITY-DMIT-ebCorona",
    ]);
  });
});

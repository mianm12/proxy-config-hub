import { describe, expect, it } from "vitest";

import type { RegionIr, RenameProfileIr } from "../../../src/compiler/ir/project-ir.ts";
import { ConfigCompilationError } from "../../../src/domain/diagnostics/diagnostic.ts";
import { extractTraits, renameProxies } from "../../../src/runtime/rename/index.ts";

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
  fields: ["subscription", "flag", "iso", "protocol", "traits", "multiplier", "sequence"],
  separator: " ",
  brackets: ["subscription", "protocol"],
  subscriptionFallback: "节点",
  extraTraits: [],
  sequence: "always",
};

describe("renameProxies", () => {
  it("不修改输入，并按完整标准名稳定编号", () => {
    const input = [
      { name: "香港 A", type: "Trojan", _subDisplayName: "机场", server: "192.0.2.1" },
      { name: "香港 B", type: "Trojan", _subDisplayName: "机场", server: "192.0.2.2" },
    ];
    const snapshot = structuredClone(input);
    const result = renameProxies(input, PROFILE, [HK]);

    expect(input).toEqual(snapshot);
    expect(result.proxies.map(({ name }) => name)).toEqual([
      "[机场] 🇭🇰 HK [trojan] 01",
      "[机场] 🇭🇰 HK [trojan] 02",
    ]);
  });

  it("按 Sub-Store 字段优先级解析订阅名", () => {
    const result = renameProxies(
      [
        {
          name: "香港",
          type: "vless",
          _subDisplayName: "显示名",
          _subName: "订阅名",
          _collectionDisplayName: "组合显示名",
          _collectionName: "组合名",
        },
        { name: "香港", type: "vless", _collectionDisplayName: "组合显示名" },
      ],
      PROFILE,
      [HK],
    );

    expect(result.proxies.map(({ name }) => name)).toEqual([
      "[显示名] 🇭🇰 HK [vless] 01",
      "[组合显示名] 🇭🇰 HK [vless] 01",
    ]);
  });

  it("保留未知地区、缺少名称和缺少协议的代理", () => {
    const result = renameProxies(
      [
        { name: "Mars", type: "vless" },
        { name: null, type: null },
      ],
      { ...PROFILE, subscriptionFallback: null },
      [HK],
    );

    expect(result.proxies.map(({ name }) => name)).toEqual([
      "🏳️ ZZ [vless] 01",
      "🏳️ ZZ [unknown] 01",
    ]);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "RENAME_UNKNOWN_REGION",
        "RENAME_INVALID_NAME",
        "RENAME_SUBSCRIPTION_NAME_MISSING",
        "RENAME_PROTOCOL_MISSING",
      ]),
    );
  });

  it("过滤流量、到期、建议和官网广告信息", () => {
    const result = renameProxies(
      [
        { name: "剩余流量：4.26 GB", type: "trojan" },
        { name: "套餐到期：长期有效", type: "trojan" },
        { name: "建议：感到卡顿请切换节点", type: "trojan" },
        { name: "防丢失官网:https://example.invalid", type: "trojan" },
        { name: "香港 测试", type: "trojan" },
      ],
      PROFILE,
      [HK],
    );

    expect(result.proxies.map(({ name }) => name)).toEqual(["[节点] 🇭🇰 HK [trojan] 测试 01"]);
    expect(
      result.diagnostics.filter(({ code }) => code === "RENAME_SUBSCRIPTION_METADATA_SKIPPED"),
    ).toHaveLength(4);
  });

  it("优先使用宿主 ISO 并根据 ISO 重新生成旗帜", () => {
    const result = renameProxies(
      [{ name: "🇨🇳【亚洲】台湾家宽01丨直连", type: "hysteria2" }],
      PROFILE,
      [HK],
      () => "tw",
    );

    expect(result.proxies[0]?.name).toBe("[节点] 🇹🇼 TW [hysteria2] 家宽 直连 01");
  });

  it.each([
    ["新加坡", "SG", "🇸🇬"],
    ["哈萨克斯坦", "KZ", "🇰🇿"],
    ["阿联酋迪拜", "AE", "🇦🇪"],
    ["尼日利亚住宅", "NG", "🇳🇬"],
    ["墨西哥", "MX", "🇲🇽"],
  ])("通过宿主识别 catalog 外地区：%s", (name, iso, flag) => {
    const result = renameProxies([{ name, type: "trojan" }], PROFILE, [HK], () => iso);
    expect(result.proxies[0]?.name).toContain(`${flag} ${iso}`);
  });

  it("宿主返回非法 ISO 或抛错时回落到 catalog", () => {
    const invalid = renameProxies([{ name: "香港", type: "vless" }], PROFILE, [HK], () => ({}));
    const failed = renameProxies([{ name: "香港", type: "vless" }], PROFILE, [HK], () => {
      throw new Error("fixture error");
    });

    expect(invalid.proxies[0]?.name).toContain("🇭🇰 HK");
    expect(invalid.diagnostics).toContainEqual(
      expect.objectContaining({ code: "RENAME_GEO_ISO_INVALID" }),
    );
    expect(failed.proxies[0]?.name).toContain("🇭🇰 HK");
    expect(failed.diagnostics).toContainEqual(
      expect.objectContaining({ code: "RENAME_GEO_RESOLVER_FAILED" }),
    );
  });

  it("规范特征、保留最具体路线并追加扩展词", () => {
    expect(extractTraits("日本 V6 家宽 移动 IPLC 游戏专线 XHTTP Reality DMIT", ["DMIT"])).toEqual([
      "IPv6",
      "家宽",
      "移动",
      "IPLC",
      "游戏",
      "XHTTP",
      "REALITY",
      "DMIT",
    ]);

    const result = renameProxies(
      [{ name: "VLESS-XHTTP-Reality-US-DMIT-proWee", type: "vless" }],
      { ...PROFILE, subscriptionFallback: "自建", extraTraits: ["DMIT", "proWee"] },
      [US],
    );
    expect(result.proxies[0]?.name).toBe("[自建] 🇺🇸 US [vless] XHTTP REALITY DMIT proWee 01");
  });

  it("duplicates 模式只给重名基础名称编号", () => {
    const result = renameProxies(
      [
        { name: "香港 A", type: "vless" },
        { name: "香港 B", type: "vless" },
        { name: "美国", type: "vless" },
      ],
      { ...PROFILE, sequence: "duplicates" },
      [HK, US],
    );

    expect(result.proxies.map(({ name }) => name)).toEqual([
      "[节点] 🇭🇰 HK [vless] 01",
      "[节点] 🇭🇰 HK [vless] 02",
      "[节点] 🇺🇸 US [vless]",
    ]);
  });

  it("duplicates 模式跳过其他基础名称已占用的序号", () => {
    const result = renameProxies(
      [
        { name: "香港", type: "vless", _subName: "机场 01" },
        { name: "香港", type: "vless", _subName: "机场" },
        { name: "香港", type: "vless", _subName: "机场" },
      ],
      {
        ...PROFILE,
        fields: ["subscription", "sequence"],
        brackets: [],
        sequence: "duplicates",
      },
      [HK],
    );

    expect(result.proxies.map(({ name }) => name)).toEqual(["机场 01", "机场 02", "机场 03"]);
  });

  it("拒绝生成空节点名", () => {
    const invalidProfile: RenameProfileIr = {
      ...PROFILE,
      fields: ["sequence"],
      brackets: [],
      subscriptionFallback: null,
      sequence: "duplicates",
    };

    expect(() => renameProxies([{ name: "香港", type: "vless" }], invalidProfile, [HK])).toThrow(
      ConfigCompilationError,
    );
    try {
      renameProxies([{ name: "香港", type: "vless" }], invalidProfile, [HK]);
    } catch (error) {
      expect((error as ConfigCompilationError).diagnostics[0]?.code).toBe(
        "RENAME_EMPTY_OUTPUT_NAME",
      );
    }
  });

  it("超过 99 个同名节点时自然扩展序号位数", () => {
    const proxies = Array.from({ length: 100 }, () => ({ name: "香港", type: "vless" }));
    const result = renameProxies(proxies, PROFILE, [HK]);
    expect(result.proxies[0]?.name).toMatch(/01$/u);
    expect(result.proxies[99]?.name).toMatch(/100$/u);
  });
});

import { describe, expect, it } from "vitest";

import type { RegionIr } from "../../../src/compiler/ir/project-ir.ts";
import { extractMultiplier, extractTags, parseNodeName } from "../../../src/domain/node/index.ts";

function region(
  id: string,
  name: string,
  emoji: string,
  codes: readonly string[],
  english: readonly string[],
  aliases: readonly string[] = [],
  cities: readonly string[] = [],
): RegionIr {
  return {
    id,
    name,
    emoji,
    codes,
    names: { zh: [name], en: english },
    aliases,
    cities,
  };
}

const CATALOG = [
  region("HK", "香港", "🇭🇰", ["HK"], ["Hong Kong"]),
  region("JP", "日本", "🇯🇵", ["JP"], ["Japan"], [], ["Tokyo"]),
  region("US", "美国", "🇺🇸", ["US", "USA"], ["United States"]),
  region("AU", "澳大利亚", "🇦🇺", ["AU"], ["Australia"], ["澳洲"], ["Sydney"]),
  region("IN", "印度", "🇮🇳", ["IN"], ["India"]),
  {
    ...region("ID", "印尼", "🇮🇩", ["ID"], ["Indonesia"]),
    names: { zh: ["印尼", "印度尼西亚"], en: ["Indonesia"] },
  },
] as const;

describe("node-domain", () => {
  it("按 flag > name > code > alias/city 的固定优先级识别地区", () => {
    expect(parseNodeName("🇯🇵 香港", CATALOG).region).toBe("JP");
    expect(parseNodeName("香港 JP", CATALOG).region).toBe("HK");
    expect(parseNodeName("Node-US-01", CATALOG).region).toBe("US");
    expect(parseNodeName("Sydney Premium", CATALOG).region).toBe("AU");
    expect(parseNodeName("AUS Premium", CATALOG).region).toBe("OTHER");
  });

  it("同位置名称优先选择更完整的信号", () => {
    expect(parseNodeName("印度尼西亚-01", CATALOG).region).toBe("ID");
  });

  it("多地区信号按最早位置确定并产生冲突诊断", () => {
    const metadata = parseNodeName("香港 Japan 混合信号", CATALOG);

    expect(metadata.region).toBe("HK");
    expect(metadata.diagnostics).toContainEqual(
      expect.objectContaining({ code: "NODE_REGION_CONFLICT", severity: "warning" }),
    );
  });

  it("提取非 1 倍率并规范为乘号标签", () => {
    expect(extractMultiplier("香港 2x")).toEqual({ value: 2, label: "2×" });
    expect(extractMultiplier("香港 x0.5")).toEqual({ value: 0.5, label: "0.5×" });
    expect(extractMultiplier("香港 1倍")).toBeUndefined();
  });

  it("标签大小写不敏感且保留输入拼写和 profile 顺序", () => {
    expect(extractTags("香港 reality IPLC", ["IPLC", "REALITY", "reality"])).toEqual([
      { configured: "IPLC", value: "IPLC" },
      { configured: "REALITY", value: "reality" },
    ]);
  });
});

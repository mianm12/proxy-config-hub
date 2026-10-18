import { describe, expect, it } from "vitest";

import {
  normalizeEntry,
  parseRulePayload,
  resolveAuditSource,
} from "../../../src/tools/audit-rules.ts";

describe("远程规则审计", () => {
  it.each([
    "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/openai",
    "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/openai",
  ])("为 MetaCubeX 标准 MRS 使用同仓库 YAML 可审计源：%s", (baseUrl) => {
    expect(
      resolveAuditSource({
        format: "mrs",
        url: `${baseUrl}.mrs`,
      }),
    ).toEqual({
      format: "yaml",
      opaque: false,
      url: `${baseUrl}.yaml`,
    });
  });

  it.each([
    "https://example.com/custom/company.mrs",
    "https://cdn.jsdelivr.net/gh/example/custom@main/company.mrs",
    "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat-other@meta/company.mrs",
  ])("不推断第三方 MRS 的 YAML 审计源：%s", (url) => {
    expect(resolveAuditSource({ format: "mrs", url })).toEqual({
      format: "mrs",
      opaque: true,
      url,
    });
  });

  it("验证 YAML payload 并支持 text 格式", () => {
    expect(
      parseRulePayload("yaml", "payload:\n  - +.example.com\n", {
        format: "yaml",
        opaque: false,
        url: "https://example.com/rules.yaml",
      }),
    ).toEqual(["+.example.com"]);
    expect(
      parseRulePayload("text", "# comment\nexample.com\n\n", {
        format: "text",
        opaque: false,
        url: "https://example.com/rules.txt",
      }),
    ).toEqual(["example.com"]);
    expect(() =>
      parseRulePayload("invalid", "not-payload: true\n", {
        format: "yaml",
        opaque: false,
        url: "https://example.com/invalid.yaml",
      }),
    ).toThrow("payload must be an array");
  });

  it("classical 常见规则参与归一化，其他规则保持精确比较", () => {
    expect(normalizeEntry("classical", "DOMAIN-SUFFIX,example.com")).toMatchObject({
      kind: "suffix",
      value: "example.com",
    });
    expect(normalizeEntry("classical", "PROCESS-NAME,ssh")).toEqual({
      kind: "classical",
      value: "process-name,ssh",
      raw: "PROCESS-NAME,ssh",
      key: "classical:process-name,ssh",
    });
  });
});

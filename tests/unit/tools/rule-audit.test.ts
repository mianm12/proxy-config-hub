import { describe, expect, it } from "vitest";

import {
  normalizeEntry,
  parseRulePayload,
  resolveAuditSource,
} from "../../../tools/check-rule-overlap.js";

describe("远程规则审计", () => {
  it("只为 MetaCubeX 标准 MRS 使用同仓库 YAML 可审计源", () => {
    expect(
      resolveAuditSource({
        format: "mrs",
        url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/openai.mrs",
      }),
    ).toEqual({
      format: "yaml",
      opaque: false,
      url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/openai.yaml",
    });
    expect(
      resolveAuditSource({ format: "mrs", url: "https://example.com/custom/company.mrs" }),
    ).toEqual({
      format: "mrs",
      opaque: true,
      url: "https://example.com/custom/company.mrs",
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

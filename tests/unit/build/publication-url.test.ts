import { describe, expect, it } from "vitest";

import { artifactPublicUrl, resolvePublicBaseUrl } from "../../../src/build/publication-url.ts";

describe("发布 URL", () => {
  it("环境变量覆盖配置且只移除末尾斜杠", () => {
    const base = resolvePublicBaseUrl(
      "https://mianm12.github.io/proxy-config-hub/",
      "https://example.com/configured",
    );

    expect(base).toBe("https://mianm12.github.io/proxy-config-hub");
    expect(artifactPublicUrl(base ?? "", "v2", "override.js")).toBe(
      "https://mianm12.github.io/proxy-config-hub/v2/override.js",
    );
    expect(artifactPublicUrl(base ?? "", "v2", "rules/个人规则.yaml")).toBe(
      "https://mianm12.github.io/proxy-config-hub/v2/rules/%E4%B8%AA%E4%BA%BA%E8%A7%84%E5%88%99.yaml",
    );
  });

  it("未配置基址时不生成 URL", () => {
    expect(resolvePublicBaseUrl(undefined, null)).toBeUndefined();
  });

  it("拒绝非 HTTP 协议和带凭据的基址", () => {
    expect(() => resolvePublicBaseUrl("file:///tmp/site", null)).toThrow("只允许 http/https");
    expect(() => resolvePublicBaseUrl("https://token@example.com/site", null)).toThrow(
      "不得包含凭据",
    );
  });
});

import { describe, expect, it } from "vitest";

import { SCHEMA_VERSION } from "../../src/version.js";

describe("v2 工具链", () => {
  it("使用已确认的 schema 版本", () => {
    expect(SCHEMA_VERSION).toBe(2);
  });
});

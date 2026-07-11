import { describe, expect, it } from "vitest";

import { compareBundleSizes } from "../../../src/build/bundle-size.ts";

describe("bundle size 回归", () => {
  it("只按已记录产物的相对增长产生回归信号", () => {
    expect(
      compareBundleSizes(
        { "override.js": 100, "rename.js": 50 },
        { "override.js": 101, "rename.js": 49 },
      ),
    ).toEqual([
      { name: "override.js", baseline: 100, actual: 101, grew: true },
      { name: "rename.js", baseline: 50, actual: 49, grew: false },
    ]);
  });
});

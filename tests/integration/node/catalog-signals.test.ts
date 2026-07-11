import path from "node:path";

import { describe, expect, it } from "vitest";

import { compileProject } from "../../../src/compiler/compile-project.ts";
import { parseNodeName } from "../../../src/domain/node/index.ts";

describe("node catalog 全量信号", () => {
  const catalog = compileProject(path.resolve(process.cwd(), "config")).nodeCatalog;

  it("每个地区的旗帜、名称、代码、别名和城市都指向声明地区", () => {
    for (const region of catalog) {
      const signalGroups = [
        [region.emoji],
        [region.name, ...region.names.zh, ...region.names.en],
        region.codes.map((code) => `Node-${code}-01`),
        [...region.aliases, ...region.cities],
      ];

      for (const signal of signalGroups.flat()) {
        expect(parseNodeName(signal, catalog).region, `${region.id} 信号解析失败: ${signal}`).toBe(
          region.id,
        );
      }
    }
  });
});

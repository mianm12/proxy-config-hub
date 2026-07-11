import fs from "node:fs";
import path from "node:path";

import { stringify } from "yaml";
import { z } from "zod";

import { CONFIG_ROOT, DIST_V2_ROOT, REPO_ROOT } from "../build/paths.ts";
import { compileProject } from "../compiler/compile-project.ts";
import { compileOverride } from "../runtime/override/index.ts";

const fixtureSchema = z.object({
  cases: z
    .array(z.object({ config: z.looseObject({ proxies: z.array(z.unknown()).min(1) }) }))
    .min(1),
});
function generateExampleV2(): string {
  const fixture = fixtureSchema.parse(
    JSON.parse(
      fs.readFileSync(
        path.join(REPO_ROOT, "tests/fixtures/v1-input/override/chain-effective.json"),
        "utf8",
      ),
    ) as unknown,
  );
  const input = fixture.cases[0]?.config;
  if (input === undefined) throw new Error("Mihomo 验证 fixture 缺少配置");
  const output = compileOverride(input, compileProject(CONFIG_ROOT)).config;
  const target = path.join(DIST_V2_ROOT, "example-full-config.yaml");

  fs.mkdirSync(DIST_V2_ROOT, { recursive: true });
  fs.writeFileSync(target, stringify(output, { lineWidth: 0 }), "utf8");
  return target;
}

if (import.meta.main) console.log(`v2 完整脱敏示例已生成：${generateExampleV2()}`);

export { generateExampleV2 };

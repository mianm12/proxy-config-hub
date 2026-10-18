import fs from "node:fs";
import path from "node:path";

import { stringify } from "yaml";

import { CONFIG_ROOT, DIST_V2_ROOT, REPO_ROOT } from "../build/paths.ts";
import { compileProject } from "../compiler/compile-project.ts";
import { compileStandaloneConfig } from "./standalone-config.ts";

function generateExample(): string {
  const template = fs.readFileSync(
    path.join(REPO_ROOT, "templates/mihomo/config-input.yaml"),
    "utf8",
  );
  const output = compileStandaloneConfig(template, compileProject(CONFIG_ROOT)).config;
  const target = path.join(DIST_V2_ROOT, "example-full-config.yaml");

  fs.mkdirSync(DIST_V2_ROOT, { recursive: true });
  fs.writeFileSync(target, stringify(output, { lineWidth: 0 }), "utf8");
  return target;
}

if (import.meta.main) console.log(`完整脱敏示例已生成：${generateExample()}`);

export { generateExample };

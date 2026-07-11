import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { DIST_V2_ROOT, REPO_ROOT } from "../build/paths.ts";
import { resolveMihomo } from "./mihomo/resolve.ts";
import { writeMihomoVerificationReceipt } from "./mihomo/verification.ts";

const mihomo = await resolveMihomo({ downloadIfMissing: false });
const config = path.join(DIST_V2_ROOT, "example-full-config.yaml");
const dataDirectory = path.join(REPO_ROOT, ".cache", "validation", "mihomo");
fs.mkdirSync(dataDirectory, { recursive: true });
const result = spawnSync(mihomo.path, ["-t", "-d", dataDirectory, "-f", config], {
  encoding: "utf8",
});

if (result.error) throw new Error(`无法执行 Mihomo: ${mihomo.path}`, { cause: result.error });
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.stdout.write(result.stdout);
  process.exit(result.status ?? 1);
}

const receipt = writeMihomoVerificationReceipt(config, mihomo);
console.log(`Mihomo 配置验证通过（版本：${receipt.mihomoVersion}，来源：${mihomo.source}）`);

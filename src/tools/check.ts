import { spawnSync } from "node:child_process";

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const steps = [
  "format:check",
  "lint",
  "typecheck",
  "config:v2:check",
  "build:v2",
  "test:v2",
  "compare:v1-v2",
  "verify:mihomo",
  "verify",
  "baseline:v1:check",
] as const;

for (const step of steps) {
  console.log(`\n[check:v2] npm run ${step}`);
  const result = spawnSync(npmExecutable, ["run", step], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw new Error(`无法执行 npm run ${step}`, { cause: result.error });
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\n[check:v2] v2 统一检查通过");

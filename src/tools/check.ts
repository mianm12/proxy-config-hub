import { spawnSync } from "node:child_process";

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const steps = [
  "format:check",
  "lint",
  "typecheck",
  "config:check",
  "build",
  "test",
  "verify:golden",
  "verify:mihomo",
] as const;

for (const step of steps) {
  console.log(`\n[check] npm run ${step}`);
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

console.log("\n[check] 统一检查通过");

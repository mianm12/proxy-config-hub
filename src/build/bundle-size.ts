import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import { DIST_V2_ROOT, REPO_ROOT } from "./paths.ts";

const baselineSchema = z.object({
  artifacts: z.record(z.string(), z.number().int().positive()),
});

interface BundleSizeComparison {
  readonly name: string;
  readonly baseline: number;
  readonly actual: number;
  readonly grew: boolean;
}

function compareBundleSizes(
  baseline: Readonly<Record<string, number>>,
  actual: Readonly<Record<string, number>>,
): readonly BundleSizeComparison[] {
  return Object.entries(baseline).map(([name, baselineBytes]) => {
    const actualBytes = actual[name];
    if (actualBytes === undefined) throw new Error(`缺少 bundle size 数据: ${name}`);
    return {
      name,
      baseline: baselineBytes,
      actual: actualBytes,
      grew: actualBytes > baselineBytes,
    };
  });
}

function reportBundleSize(): void {
  const baseline = baselineSchema.parse(
    JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, "tooling", "bundle-size-baseline.json"), "utf8"),
    ) as unknown,
  ).artifacts;
  const actual = Object.fromEntries(
    Object.keys(baseline).map((name) => [name, fs.statSync(path.join(DIST_V2_ROOT, name)).size]),
  );

  for (const comparison of compareBundleSizes(baseline, actual)) {
    if (!comparison.grew) continue;
    console.warn(
      `[build:v2] bundle size 回归: ${comparison.name} ${String(comparison.baseline)} → ${String(comparison.actual)} bytes`,
    );
  }
}

export { compareBundleSizes, reportBundleSize };
export type { BundleSizeComparison };

import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import { REPO_ROOT } from "../../build/paths.ts";

const assetSchema = z.object({
  asset: z.string().endsWith(".gz"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const lockSchema = z.object({
  version: z.string().regex(/^v\d+\.\d+\.\d+$/),
  releaseBaseUrl: z.literal("https://github.com/MetaCubeX/mihomo/releases/download"),
  platforms: z.record(z.string(), assetSchema),
});

type MihomoLock = z.infer<typeof lockSchema>;
type MihomoAsset = z.infer<typeof assetSchema>;

const MIHOMO_LOCK_PATH = path.join(REPO_ROOT, "tooling", "mihomo.lock.json");

function loadMihomoLock(): MihomoLock {
  return lockSchema.parse(JSON.parse(fs.readFileSync(MIHOMO_LOCK_PATH, "utf8")) as unknown);
}

export { loadMihomoLock, MIHOMO_LOCK_PATH };
export type { MihomoAsset, MihomoLock };

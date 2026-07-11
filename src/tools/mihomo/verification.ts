import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import { REPO_ROOT } from "../../build/paths.ts";
import { loadMihomoLock } from "./lock.ts";
import type { ResolvedMihomo } from "./resolve.ts";

const receiptSchema = z.object({
  configSha256: z.string().regex(/^[a-f0-9]{64}$/),
  mihomoVersion: z.string().regex(/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/),
  lockVersion: z.string().regex(/^v\d+\.\d+\.\d+$/),
  source: z.enum(["MIHOMO_BIN", "PATH", "cache"]),
});

type MihomoVerificationReceipt = z.infer<typeof receiptSchema>;

const MIHOMO_VERIFICATION_RECEIPT = path.join(
  REPO_ROOT,
  ".cache",
  "validation",
  "mihomo-verification.json",
);

function sha256File(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function parseMihomoVersion(output: string): string {
  const match = /\bMihomo\s+Meta\s+(v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/iu.exec(output);
  if (match?.[1] === undefined) throw new Error(`无法解析 Mihomo 版本输出: ${output.trim()}`);
  return match[1];
}

function inspectMihomoVersion(binary: string): string {
  const result = spawnSync(binary, ["-v"], { encoding: "utf8" });
  if (result.error) throw new Error(`无法读取 Mihomo 版本: ${binary}`, { cause: result.error });
  if (result.status !== 0) {
    throw new Error(`Mihomo -v 执行失败: ${result.stderr || result.stdout}`);
  }
  return parseMihomoVersion(`${result.stdout}\n${result.stderr}`);
}

function writeMihomoVerificationReceipt(
  config: string,
  mihomo: ResolvedMihomo,
  receiptPath: string = MIHOMO_VERIFICATION_RECEIPT,
): MihomoVerificationReceipt {
  const mihomoVersion = inspectMihomoVersion(mihomo.path);
  if (mihomo.version !== undefined && mihomo.version !== mihomoVersion) {
    throw new Error(`Mihomo 缓存版本与锁文件不一致: ${mihomoVersion} / ${mihomo.version}`);
  }
  const receipt = receiptSchema.parse({
    configSha256: sha256File(config),
    mihomoVersion,
    lockVersion: loadMihomoLock().version,
    source: mihomo.source,
  });

  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  const temporary = `${receiptPath}.tmp-${String(process.pid)}-${crypto.randomUUID()}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    fs.renameSync(temporary, receiptPath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return receipt;
}

function loadMihomoVerificationReceipt(
  config: string,
  receiptPath: string = MIHOMO_VERIFICATION_RECEIPT,
): MihomoVerificationReceipt {
  let receipt: MihomoVerificationReceipt;
  try {
    receipt = receiptSchema.parse(JSON.parse(fs.readFileSync(receiptPath, "utf8")) as unknown);
  } catch (error) {
    throw new Error("缺少有效的 Mihomo 验证回执，请先执行 npm run check", { cause: error });
  }
  if (receipt.lockVersion !== loadMihomoLock().version) {
    throw new Error("Mihomo 验证回执的锁定版本已过期，请重新执行 npm run check");
  }
  if (receipt.configSha256 !== sha256File(config)) {
    throw new Error("发布示例与 Mihomo 验证回执不一致，请重新执行 npm run check");
  }
  return receipt;
}

export {
  inspectMihomoVersion,
  loadMihomoVerificationReceipt,
  MIHOMO_VERIFICATION_RECEIPT,
  parseMihomoVersion,
  writeMihomoVerificationReceipt,
};
export type { MihomoVerificationReceipt };

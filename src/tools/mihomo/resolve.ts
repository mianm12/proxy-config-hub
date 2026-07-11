import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { REPO_ROOT } from "../../build/paths.ts";
import { loadMihomoLock, type MihomoAsset, type MihomoLock } from "./lock.ts";

type MihomoSource = "MIHOMO_BIN" | "PATH" | "cache";

const DOWNLOAD_TIMEOUT_MS = 300_000;
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;

interface ResolvedMihomo {
  readonly path: string;
  readonly source: MihomoSource;
  readonly version?: string;
}

interface ResolveMihomoOptions {
  readonly downloadIfMissing: boolean;
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  readonly arch?: string;
  readonly cwd?: string;
}

function isExecutable(file: string): boolean {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function explicitMihomo(env: NodeJS.ProcessEnv, cwd: string): string | undefined {
  const configured = env["MIHOMO_BIN"];
  if (configured === undefined || configured.trim().length === 0) return undefined;
  const resolved = path.resolve(cwd, configured.trim());
  if (!isExecutable(resolved)) throw new Error(`MIHOMO_BIN 不存在或不可执行: ${resolved}`);
  return resolved;
}

function pathMihomo(env: NodeJS.ProcessEnv): string | undefined {
  const pathValue = env["PATH"];
  if (pathValue === undefined) return undefined;
  for (const directory of pathValue.split(path.delimiter)) {
    if (directory.length === 0) continue;
    const candidate = path.join(directory, "mihomo");
    if (isExecutable(candidate)) return candidate;
  }
  return undefined;
}

function platformKey(platform: NodeJS.Platform, arch: string): string {
  return `${platform}-${arch}`;
}

function cacheBinary(lock: MihomoLock, key: string): string {
  return path.join(REPO_ROOT, ".cache", "tools", "mihomo", lock.version, key, "mihomo");
}

function sha256(value: Uint8Array): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function downloadAsset(lock: MihomoLock, asset: MihomoAsset, target: string): Promise<void> {
  const url = `${lock.releaseBaseUrl}/${lock.version}/${asset.asset}`;
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Mihomo 下载失败: HTTP ${String(response.status)} ${url}`);
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_ARCHIVE_BYTES) {
    throw new Error(`Mihomo 归档超过大小上限: ${String(declaredSize)} bytes`);
  }
  const archive = new Uint8Array(await response.arrayBuffer());
  if (archive.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error(`Mihomo 归档超过大小上限: ${String(archive.byteLength)} bytes`);
  }
  const actualChecksum = sha256(archive);
  if (actualChecksum !== asset.sha256) {
    throw new Error(`Mihomo checksum 不匹配: 期望 ${asset.sha256}，实际 ${actualChecksum}`);
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${String(process.pid)}-${crypto.randomUUID()}`;
  try {
    fs.writeFileSync(temporary, gunzipSync(archive), { mode: 0o755 });
    fs.renameSync(temporary, target);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

async function resolveMihomo(options: ResolveMihomoOptions): Promise<ResolvedMihomo> {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const explicit = explicitMihomo(env, cwd);
  if (explicit !== undefined) return { path: explicit, source: "MIHOMO_BIN" };

  const fromPath = pathMihomo(env);
  if (fromPath !== undefined) return { path: fromPath, source: "PATH" };

  const lock = loadMihomoLock();
  const key = platformKey(options.platform ?? process.platform, options.arch ?? process.arch);
  const asset = lock.platforms[key];
  if (asset === undefined) {
    throw new Error(`Mihomo 锁定工具不支持当前平台: ${key}`);
  }
  const cached = cacheBinary(lock, key);
  if (!isExecutable(cached)) {
    if (!options.downloadIfMissing) {
      throw new Error(`Mihomo 缓存不存在，请先执行 npm run tools:setup: ${cached}`);
    }
    await downloadAsset(lock, asset, cached);
  }
  return { path: cached, source: "cache", version: lock.version };
}

export { resolveMihomo };
export type { ResolvedMihomo, ResolveMihomoOptions };

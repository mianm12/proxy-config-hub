import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import { buildV2 } from "../build/build-v2.ts";
import { CONFIG_ROOT, DIST_V2_ROOT, REPO_ROOT } from "../build/paths.ts";
import {
  CORE_PUBLICATION_ARTIFACTS,
  RELEASE_CHECKSUM_FILES,
} from "../build/publication-artifacts.ts";
import { artifactPublicUrl, resolvePublicBaseUrl } from "../build/publication-url.ts";
import { compileProject } from "../compiler/compile-project.ts";
import { SCHEMA_VERSION } from "../version.ts";
import { generateExampleV2 } from "./generate-example-v2.ts";
import { loadMihomoVerificationReceipt } from "./mihomo/verification.ts";

const packageSchema = z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/) });

function sha256(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function repositoryCommit(): string {
  const fromCi = process.env["GITHUB_SHA"];
  if (fromCi !== undefined && fromCi.length > 0) return fromCi;
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error("无法解析发布 commit");
  const status = spawnSync("git", ["status", "--porcelain", "--untracked-files=normal"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (status.status !== 0) throw new Error("无法检查发布工作区状态");
  return `${result.stdout.trim()}${status.stdout.trim().length === 0 ? "" : "-dirty"}`;
}

function createRulesArchive(
  rulesDirectory: string,
  target: string,
  relativeFiles: readonly string[],
): void {
  if (relativeFiles.length === 0) throw new Error("规则资产目录不得为空");
  const tarFile = `${target}.tmp.tar`;
  const gzipFile = `${target}.tmp.gz`;
  const metadataArguments =
    process.platform === "darwin"
      ? ["--format", "ustar", "--uid", "0", "--gid", "0", "--uname", "root", "--gname", "root"]
      : ["--format=ustar", "--owner=0", "--group=0", "--numeric-owner"];
  try {
    const tarResult = spawnSync(
      "tar",
      [...metadataArguments, "-cf", tarFile, "--", ...relativeFiles],
      {
        cwd: rulesDirectory,
        encoding: "utf8",
      },
    );
    if (tarResult.error) throw new Error("无法执行 tar 生成规则资产包", { cause: tarResult.error });
    if (tarResult.status !== 0) throw new Error(`规则资产包生成失败: ${tarResult.stderr}`);

    const output = fs.openSync(gzipFile, "w", 0o644);
    try {
      const gzipResult = spawnSync("gzip", ["-n", "-9", "-c", tarFile], {
        encoding: "utf8",
        stdio: ["ignore", output, "pipe"],
      });
      if (gzipResult.error)
        throw new Error("无法执行 gzip 压缩规则资产包", { cause: gzipResult.error });
      if (gzipResult.status !== 0) throw new Error(`规则资产压缩失败: ${gzipResult.stderr}`);
    } finally {
      fs.closeSync(output);
    }
    fs.renameSync(gzipFile, target);
  } finally {
    fs.rmSync(tarFile, { force: true });
    fs.rmSync(gzipFile, { force: true });
  }
}

function copyRuleAssets(source: string, target: string): void {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (/[\r\n]/.test(entry.name)) throw new Error(`规则资产文件名无效: ${entry.name}`);
    const sourceEntry = path.join(source, entry.name);
    const targetEntry = path.join(target, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`规则资产禁止符号链接: ${sourceEntry}`);
    if (entry.isDirectory()) {
      copyRuleAssets(sourceEntry, targetEntry);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourceEntry, targetEntry);
      fs.chmodSync(targetEntry, 0o644);
      fs.utimesSync(targetEntry, 0, 0);
    } else {
      throw new Error(`规则资产类型不受支持: ${sourceEntry}`);
    }
  }
}

function listPublicationFiles(directory: string, prefix: string): readonly string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry): readonly string[] => {
      const name = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) return listPublicationFiles(path.join(directory, entry.name), name);
      if (!entry.isFile()) throw new Error(`发布资产类型不受支持: ${name}`);
      return [name];
    })
    .sort();
}

async function buildPublication(): Promise<void> {
  await buildV2();
  generateExampleV2();
  const exampleConfig = path.join(DIST_V2_ROOT, "example-full-config.yaml");
  const mihomoVerification = loadMihomoVerificationReceipt(exampleConfig);

  const rulesDirectory = path.join(DIST_V2_ROOT, "rules");
  copyRuleAssets(path.join(REPO_ROOT, "definitions", "assets", "custom"), rulesDirectory);
  const ruleArtifacts = listPublicationFiles(rulesDirectory, "rules");
  const rulesArchive = path.join(DIST_V2_ROOT, "rules.tar.gz");
  createRulesArchive(
    rulesDirectory,
    rulesArchive,
    ruleArtifacts.map((name) => name.slice("rules/".length)),
  );

  const packageMetadata = packageSchema.parse(
    JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as unknown,
  );
  const project = compileProject(CONFIG_ROOT);
  const publicBaseUrl = resolvePublicBaseUrl(
    process.env["PUBLIC_BASE_URL"],
    project.deployment.publicBaseUrl,
  );
  const artifacts = [...CORE_PUBLICATION_ARTIFACTS, ...ruleArtifacts];
  const artifactDigests = Object.fromEntries(
    artifacts.map((name) => [
      name,
      {
        sha256: sha256(path.join(DIST_V2_ROOT, name)),
        ...(publicBaseUrl === undefined
          ? {}
          : { url: artifactPublicUrl(publicBaseUrl, project.deployment.channel, name) }),
      },
    ]),
  );
  const manifest = {
    version: packageMetadata.version,
    schemaVersion: SCHEMA_VERSION,
    channel: project.deployment.channel,
    ...(publicBaseUrl === undefined ? {} : { baseUrl: publicBaseUrl }),
    commit: repositoryCommit(),
    builtAt: new Date().toISOString(),
    mihomoVersion: mihomoVerification.mihomoVersion,
    artifacts: artifactDigests,
  };
  const manifestPath = path.join(DIST_V2_ROOT, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const checksumFiles = [...RELEASE_CHECKSUM_FILES].sort();
  const checksums = checksumFiles
    .map((name) => `${sha256(path.join(DIST_V2_ROOT, name))}  ${name}`)
    .join("\n");
  fs.writeFileSync(path.join(DIST_V2_ROOT, "checksums.txt"), `${checksums}\n`, "utf8");
}

await buildPublication();
console.log(`v2 发布资产已生成：${DIST_V2_ROOT}`);

export { buildPublication };

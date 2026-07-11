import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import { DIST_V2_ROOT, REPO_ROOT } from "../build/paths.ts";
import {
  CORE_PUBLICATION_ARTIFACTS,
  RELEASE_CHECKSUM_FILES,
} from "../build/publication-artifacts.ts";
import { artifactPublicUrl } from "../build/publication-url.ts";
import { SCHEMA_VERSION } from "../version.ts";
import { loadMihomoVerificationReceipt } from "./mihomo/verification.ts";

const digestSchema = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  url: z.url().optional(),
});
const manifestSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  schemaVersion: z.number().int(),
  channel: z.literal("v2"),
  baseUrl: z.url().optional(),
  commit: z.string().regex(/^[a-f0-9]{40}(?:-dirty)?$/),
  builtAt: z.iso.datetime(),
  mihomoVersion: z.string(),
  artifacts: z.record(z.string(), digestSchema),
});
const packageSchema = z.object({ version: z.string() });

function sha256(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function artifactPath(name: string): string {
  const file = path.resolve(DIST_V2_ROOT, name);
  const relative = path.relative(DIST_V2_ROOT, file);
  if (
    name.length === 0 ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    /[\r\n]/.test(name)
  ) {
    throw new Error(`artifact 路径越界或格式无效: ${name}`);
  }
  return file;
}

const manifest = manifestSchema.parse(
  JSON.parse(fs.readFileSync(path.join(DIST_V2_ROOT, "manifest.json"), "utf8")) as unknown,
);
const packageMetadata = packageSchema.parse(
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as unknown,
);

if (manifest.version !== packageMetadata.version) throw new Error("manifest 与 package 版本不一致");
if (manifest.schemaVersion !== SCHEMA_VERSION) throw new Error("manifest schemaVersion 不一致");
const mihomoVerification = loadMihomoVerificationReceipt(
  path.join(DIST_V2_ROOT, "example-full-config.yaml"),
);
if (manifest.mihomoVersion !== mihomoVerification.mihomoVersion)
  throw new Error("manifest Mihomo 版本不一致");
for (const required of CORE_PUBLICATION_ARTIFACTS) {
  if (manifest.artifacts[required] === undefined)
    throw new Error(`manifest 缺少 artifact: ${required}`);
}

for (const [name, digest] of Object.entries(manifest.artifacts)) {
  const file = artifactPath(name);
  if (!fs.lstatSync(file).isFile())
    throw new Error(`manifest artifact 不存在或不是普通文件: ${name}`);
  if (sha256(file) !== digest.sha256) throw new Error(`manifest artifact checksum 不一致: ${name}`);
  const expectedUrl =
    manifest.baseUrl === undefined
      ? undefined
      : artifactPublicUrl(manifest.baseUrl, manifest.channel, name);
  if (digest.url !== expectedUrl) throw new Error(`manifest artifact URL 不一致: ${name}`);
}

const expectedChecksums = fs
  .readFileSync(path.join(DIST_V2_ROOT, "checksums.txt"), "utf8")
  .trim()
  .split("\n")
  .map((line) => /^([a-f0-9]{64}) {2}(.+)$/.exec(line))
  .map((match) => {
    if (match === null) throw new Error("checksums.txt 格式无效");
    return { checksum: match[1], name: match[2] };
  });
const expectedChecksumNames = [...RELEASE_CHECKSUM_FILES].sort();
const actualChecksumNames = expectedChecksums.map(({ name }) => name).sort();
if (JSON.stringify(actualChecksumNames) !== JSON.stringify(expectedChecksumNames)) {
  throw new Error("checksums.txt 未精确覆盖 manifest 与全部 artifact");
}
for (const { checksum, name } of expectedChecksums) {
  if (name === undefined || checksum === undefined) throw new Error("checksums.txt 条目无效");
  if (sha256(artifactPath(name)) !== checksum) {
    throw new Error(`checksums.txt 校验失败: ${name}`);
  }
}

const tag = process.env["GITHUB_REF_NAME"];
if (process.env["GITHUB_REF_TYPE"] === "tag" && tag !== `v${manifest.version}`) {
  throw new Error(`tag ${tag ?? "<missing>"} 与版本 v${manifest.version} 不一致`);
}
if (process.env["GITHUB_REF_TYPE"] === "tag" && manifest.commit.endsWith("-dirty")) {
  throw new Error("禁止从 dirty 工作区验证 Release tag");
}

console.log(`v2 发布资产验证通过：v${manifest.version}`);

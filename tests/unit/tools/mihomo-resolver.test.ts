import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadMihomoLock } from "../../../src/tools/mihomo/lock.ts";
import { resolveMihomo } from "../../../src/tools/mihomo/resolve.ts";

const workspaces: string[] = [];

function executable(directory: string, name = "mihomo"): string {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, name);
  fs.writeFileSync(file, "#!/bin/sh\n", { mode: 0o755 });
  return file;
}

afterEach(() => {
  workspaces.splice(0).forEach((workspace) => {
    fs.rmSync(workspace, { force: true, recursive: true });
  });
});

describe("Mihomo 工具解析器", () => {
  it("优先使用 MIHOMO_BIN，其次使用 PATH", async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "proxy-config-hub-mihomo-"));
    workspaces.push(workspace);
    const explicit = executable(path.join(workspace, "explicit"), "custom-mihomo");
    const fromPath = executable(path.join(workspace, "path"));

    await expect(
      resolveMihomo({
        downloadIfMissing: false,
        cwd: workspace,
        env: { MIHOMO_BIN: explicit, PATH: path.dirname(fromPath) },
      }),
    ).resolves.toMatchObject({ path: explicit, source: "MIHOMO_BIN" });
    await expect(
      resolveMihomo({
        downloadIfMissing: false,
        cwd: workspace,
        env: { PATH: path.dirname(fromPath) },
      }),
    ).resolves.toMatchObject({ path: fromPath, source: "PATH" });
  });

  it("显式路径无效时直接失败，不静默降级", async () => {
    await expect(
      resolveMihomo({
        downloadIfMissing: false,
        env: { MIHOMO_BIN: "/not-found/mihomo", PATH: "" },
      }),
    ).rejects.toThrow("MIHOMO_BIN 不存在或不可执行");
  });

  it("锁定 macOS 与 Linux 的 x64/arm64 官方资产", () => {
    const lock = loadMihomoLock();

    expect(lock.version).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(Object.keys(lock.platforms).sort()).toEqual([
      "darwin-arm64",
      "darwin-x64",
      "linux-arm64",
      "linux-x64",
    ]);
    Object.values(lock.platforms).forEach(({ asset, sha256 }) => {
      expect(asset).toContain(lock.version);
      expect(sha256).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});

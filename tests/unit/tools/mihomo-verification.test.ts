import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadMihomoVerificationReceipt,
  parseMihomoVersion,
} from "../../../src/tools/mihomo/verification.ts";
import { loadMihomoLock } from "../../../src/tools/mihomo/lock.ts";

describe("Mihomo 验证回执", () => {
  it("解析官方版本输出", () => {
    expect(
      parseMihomoVersion(
        "Mihomo Meta v1.19.28 linux amd64 with go1.26.5 Wed Jul 8 00:22:34 UTC 2026",
      ),
    ).toBe("v1.19.28");
  });

  it("只接受与当前示例和锁文件一致的回执", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "mihomo-verification-"));
    const config = path.join(workspace, "config.yaml");
    const receipt = path.join(workspace, "receipt.json");
    fs.writeFileSync(config, "proxies: []\n", "utf8");
    fs.writeFileSync(
      receipt,
      `${JSON.stringify({
        configSha256: "0000000000000000000000000000000000000000000000000000000000000000",
        mihomoVersion: "v1.19.28",
        lockVersion: loadMihomoLock().version,
        source: "cache",
      })}\n`,
      "utf8",
    );

    try {
      expect(() => loadMihomoVerificationReceipt(config, receipt)).toThrow(
        "发布示例与 Mihomo 验证回执不一致",
      );
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});

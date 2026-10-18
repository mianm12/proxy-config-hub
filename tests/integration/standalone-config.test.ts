import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { CONFIG_ROOT, REPO_ROOT } from "../../src/build/paths.ts";
import { compileProject } from "../../src/compiler/compile-project.ts";
import { compileOverride } from "../../src/runtime/override/index.ts";
import { generateConfig } from "../../src/tools/generate-config.ts";
import { compileStandaloneConfig } from "../../src/tools/standalone-config.ts";

const proxy = { name: "香港-测试节点", type: "socks5", server: "192.0.2.1", port: 1080 };
const project = compileProject(CONFIG_ROOT);

function withWorkspace(operation: (workspace: string) => void): void {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "standalone-config-"));
  try {
    operation(workspace);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

function runCli(args: string[]) {
  return spawnSync(
    process.execPath,
    [path.join(REPO_ROOT, "src/tools/generate-config.ts"), ...args],
    { encoding: "utf8" },
  );
}

describe("独立完整配置生成", () => {
  it("仅提取节点，与 override 共用输出契约且忽略输入宿主设置", () => {
    const text = JSON.stringify({
      proxies: [proxy],
      tun: { enable: false },
      "mixed-port": 9999,
      "external-controller": "0.0.0.0:9090",
    });
    const result = compileStandaloneConfig(text, project);
    expect(result).toEqual(compileOverride({ proxies: [proxy] }, project));
    expect(result.config).not.toHaveProperty("external-controller");
    expect(result.config["tun"]).toMatchObject({ enable: true });
    expect(result.config["profile"]).toEqual({ "store-selected": true, "store-fake-ip": true });
  });

  it.each([
    ["空节点", "proxies: []"],
    ["无效节点", JSON.stringify({ proxies: [proxy, { type: "socks5" }] })],
    ["空白名称", JSON.stringify({ proxies: [{ ...proxy, name: " " }] })],
    ["空白类型", JSON.stringify({ proxies: [{ ...proxy, type: " " }] })],
    ["重名节点", JSON.stringify({ proxies: [proxy, proxy] })],
    ["重复 YAML 键", "proxies: []\nproxies: []"],
    ["别名", "proxies: &nodes []\ncopy: *nodes"],
  ])("拒绝%s，不丢弃坏节点后返回部分成功", (_name, text) => {
    expect(() => compileStandaloneConfig(text, project)).toThrow();
  });

  it("命令生成完整私有文件并保留输入，不遗留暂存文件", () => {
    withWorkspace((workspace) => {
      const input = path.join(workspace, "nodes.yaml");
      const output = path.join(workspace, "config.yaml");
      const original = JSON.stringify({ proxies: [proxy] });
      fs.writeFileSync(input, original);
      const result = runCli(["--input", input, "--output", output]);
      expect(result.status, result.stderr).toBe(0);
      expect(parse(fs.readFileSync(output, "utf8"))).toEqual(
        compileOverride({ proxies: [proxy] }, project).config,
      );
      expect(fs.statSync(output).mode & 0o777).toBe(0o600);
      expect(fs.readFileSync(input, "utf8")).toBe(original);
      expect(fs.readdirSync(workspace).sort()).toEqual(["config.yaml", "nodes.yaml"]);
      expect(result.stdout + result.stderr).not.toContain(proxy.server);
      expect(result.stderr).toContain("配置装配警告");
    });
  });

  it("拒绝覆盖已有文件和原输入", () => {
    withWorkspace((workspace) => {
      const input = path.join(workspace, "nodes.yaml");
      const output = path.join(workspace, "config.yaml");
      fs.writeFileSync(input, JSON.stringify({ proxies: [proxy] }));
      fs.writeFileSync(output, "原有配置");
      expect(() => generateConfig(input, output)).toThrow("已存在");
      expect(() => generateConfig(input, input)).toThrow("已存在");
      expect(fs.readFileSync(output, "utf8")).toBe("原有配置");
    });
  });

  it("拒绝发布目录及指向仓库的目录链接", () => {
    withWorkspace((workspace) => {
      const linked = path.join(workspace, "repo");
      fs.symlinkSync(REPO_ROOT, linked, "dir");
      expect(() =>
        generateConfig("unused.yaml", path.join(REPO_ROOT, "dist/v2/private.yaml")),
      ).toThrow("仓库之外");
      expect(() => generateConfig("unused.yaml", path.join(linked, "private.yaml"))).toThrow(
        "仓库之外",
      );
    });
  });

  it("错误 YAML 返回非零且不泄露内容或产生输出文件", () => {
    withWorkspace((workspace) => {
      const input = path.join(workspace, "nodes.yaml");
      const output = path.join(workspace, "config.yaml");
      const marker = "fixture-private-marker";
      fs.writeFileSync(input, `proxies: [\npassword: ${marker}`);
      const result = runCli(["--input", input, "--output", output]);
      expect(result.status).toBe(1);
      expect(result.stdout + result.stderr).not.toContain(marker);
      expect(result.stderr).toContain("YAML 无效");
      expect(fs.existsSync(output)).toBe(false);
      expect(fs.readdirSync(workspace)).toEqual(["nodes.yaml"]);
    });
  });

  it("帮助和缺参的退出码明确", () => {
    expect(runCli(["--help"]).status).toBe(0);
    expect(runCli([]).status).toBe(1);
  });
});

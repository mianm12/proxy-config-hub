import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { compileProject } from "../../../src/compiler/compile-project.ts";
import { ConfigCompilationError } from "../../../src/domain/diagnostics/diagnostic.ts";

function withConfigWorkspace(operation: (configRoot: string) => void): void {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "proxy-config-semantic-"));
  const configRoot = path.join(workspace, "config");
  fs.cpSync(path.resolve(process.cwd(), "config"), configRoot, { recursive: true });

  try {
    operation(configRoot);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

function transform(
  configRoot: string,
  relativePath: string,
  transformText: (text: string) => string,
) {
  const file = path.join(configRoot, relativePath);
  const current = fs.readFileSync(file, "utf8");
  const next = transformText(current);
  expect(next).not.toBe(current);
  fs.writeFileSync(file, next, "utf8");
}

function captureDiagnostics(configRoot: string): ConfigCompilationError {
  try {
    compileProject(configRoot);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigCompilationError);
    return error as ConfigCompilationError;
  }
  throw new Error("期望无效配置编译失败");
}

function expectCode(error: ConfigCompilationError, code: string): void {
  expect(error.diagnostics.map((diagnostic) => diagnostic.code)).toContain(code);
}

describe("semantic diagnostics", () => {
  it("定位跨模块重复 group ID", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "routing/modules/ai.yaml", (text) =>
        text.replace("id: ai_service", "id: private"),
      );
      const error = captureDiagnostics(configRoot);

      expectCode(error, "CFG_DUPLICATE_ID");
      expect(
        error.diagnostics.some(
          ({ code, source }) =>
            code === "CFG_DUPLICATE_ID" &&
            source?.file.endsWith("routing/modules/ai.yaml") === true &&
            source.path === "groups[0]",
        ),
      ).toBe(true);
    });
  });

  it("拒绝未知模板引用与 layout 遗漏", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "routing/modules/ai.yaml", (text) =>
        text.replace("template: proxy_service", "template: missing_template"),
      );
      transform(configRoot, "manifest.yaml", (text) => text.replace("    - group: shopping\n", ""));
      const error = captureDiagnostics(configRoot);

      expectCode(error, "CFG_UNKNOWN_REFERENCE");
      expectCode(error, "CFG_LAYOUT_MISSING_GROUP");
    });
  });

  it("拒绝重复 pipeline block 与 provider path collision", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "manifest.yaml", (text) =>
        text.replace(
          "    - { module: ai, block: services }\n",
          "    - { module: ai, block: services }\n    - { module: ai, block: services }\n",
        ),
      );
      transform(configRoot, "routing/provider-sources.yaml", (text) =>
        text.replaceAll(
          'path-template: "./ruleset/{id}.mrs"',
          'path-template: "./ruleset/shared.mrs"',
        ),
      );
      const error = captureDiagnostics(configRoot);

      expectCode(error, "CFG_PIPELINE_DUPLICATE_BLOCK");
      expectCode(error, "CFG_PROVIDER_PATH_COLLISION");
    });
  });

  it("拒绝一跳拓扑自环", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "nodes/chains.yaml", (text) =>
        text.replace("      id: landing", "      id: transit"),
      );
      const error = captureDiagnostics(configRoot);

      expectCode(error, "CFG_TOPOLOGY_CYCLE");
    });
  });

  it("拒绝 provider URL 中的凭据", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "routing/provider-sources.yaml", (text) =>
        text.replace(
          "https://raw.githubusercontent.com/MetaCubeX",
          "https://token@raw.githubusercontent.com/MetaCubeX",
        ),
      );
      const error = captureDiagnostics(configRoot);

      expectCode(error, "CFG_SECRET_LIKE_URL");
    });
  });
});

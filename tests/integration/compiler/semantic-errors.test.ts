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
  it("完整自定义 provider 可编译到 Project IR", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "routing/provider-sources.yaml", (text) =>
        text.replace(
          "      interval: 86400\n\n  metacubex_geoip:",
          "      interval: 86400\n    mihomo:\n      size-limit: 1048576\n\n  metacubex_geoip:",
        ),
      );
      transform(configRoot, "routing/modules/ai.yaml", (text) =>
        text.replace(
          "      - { source: metacubex_geosite, name: category-ai-chat-!cn }",
          `      - { source: metacubex_geosite, name: category-ai-chat-!cn }
      - id: personal_custom
        provider:
          type: http
          behavior: classical
          format: yaml
          url: https://example.com/personal.yaml
          path: ./ruleset/personal.yaml
          interval: 3600
        mihomo:
          proxy: DIRECT
      - id: personal_inline
        provider:
          type: inline
          behavior: domain
        mihomo:
          payload:
            - +.personal.example`,
        ),
      );
      const project = compileProject(configRoot);

      expect(project.providers.find(({ id }) => id === "openai")?.config.mihomo).toEqual({
        "size-limit": 1048576,
      });

      expect(project.providers).toContainEqual({
        id: "personal_custom",
        target: "ai_service",
        noResolve: false,
        config: {
          type: "http",
          behavior: "classical",
          format: "yaml",
          url: "https://example.com/personal.yaml",
          path: "./ruleset/personal.yaml",
          interval: 3600,
          mihomo: { proxy: "DIRECT" },
        },
      });
      expect(project.providers).toContainEqual({
        id: "personal_inline",
        target: "ai_service",
        noResolve: false,
        config: {
          type: "inline",
          behavior: "domain",
          mihomo: { payload: ["+.personal.example"] },
        },
      });
    });
  });

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

  it("拒绝 catalog 重定义 OTHER fallback", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "nodes/catalog.yaml", (text) =>
        text.replace("  - id: HK", "  - id: OTHER"),
      );
      const error = captureDiagnostics(configRoot);

      expectCode(error, "CFG_REGION_FALLBACK_INVALID");
    });
  });

  it("拒绝配置组与动态生成组显示名冲突", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "nodes/routing-regions.yaml", (text) =>
        text.replace('group-name: "🇭🇰 香港"', 'group-name: "🐟 漏网之鱼"'),
      );
      const error = captureDiagnostics(configRoot);

      expectCode(error, "CFG_DUPLICATE_NAME");
    });
  });

  it("拒绝遗漏有声明数据的动态生成段", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "manifest.yaml", (text) =>
        text.replace("    - generated: transit_groups\n", ""),
      );
      const error = captureDiagnostics(configRoot);

      expectCode(error, "CFG_LAYOUT_MISSING_GENERATED");
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

  it("拒绝 YAML 透传区中的非空敏感字段", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "runtime/base.yaml", (text) => `${text}\nsecret: should-not-commit\n`);
      const error = captureDiagnostics(configRoot);

      expectCode(error, "CFG_SECRET_LIKE_VALUE");
      expect(
        error.diagnostics.some(
          ({ source }) =>
            source?.file.endsWith("runtime/base.yaml") === true && source.path === "secret",
        ),
      ).toBe(true);
    });
  });

  it("拒绝任意公开 YAML 字符串中的敏感 URL", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "runtime/dns.yaml", (text) =>
        text.replace(
          "https://dns.alidns.com/dns-query",
          "https://user@example.com/dns-query?access_token=should-not-commit",
        ),
      );
      const error = captureDiagnostics(configRoot);

      expect(error.diagnostics.filter(({ code }) => code === "CFG_SECRET_LIKE_URL")).toHaveLength(
        2,
      );
      expect(
        error.diagnostics.every(
          ({ code, source }) =>
            code !== "CFG_SECRET_LIKE_URL" ||
            (source?.file.endsWith("runtime/dns.yaml") === true && source.line !== undefined),
        ),
      ).toBe(true);
    });
  });

  it("拒绝不完整 inline provider 与 classical MRS", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "routing/modules/ai.yaml", (text) =>
        text.replace(
          "      - { source: metacubex_geosite, name: category-ai-chat-!cn }",
          `      - { source: metacubex_geosite, name: category-ai-chat-!cn }
      - id: invalid_inline
        provider:
          type: inline
          behavior: domain
      - id: invalid_mrs
        provider:
          type: http
          behavior: classical
          format: mrs
          url: https://example.com/classical.mrs
          path: ./ruleset/classical.mrs`,
        ),
      );
      const error = captureDiagnostics(configRoot);

      expectCode(error, "CFG_PROVIDER_INCOMPLETE");
      expectCode(error, "CFG_PROVIDER_FIELD_INVALID");
    });
  });

  it("拒绝发布基址中的凭据、query 和 fragment", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "manifest.yaml", (text) =>
        text.replace(
          "  public-base-url: null",
          "  public-base-url: https://token@example.com/site?key=value#fragment",
        ),
      );
      const error = captureDiagnostics(configRoot);

      expectCode(error, "CFG_SCHEMA_INVALID");
      expect(
        error.diagnostics.some(
          ({ source }) =>
            source?.path === "deployment.public-base-url" && source.line !== undefined,
        ),
      ).toBe(true);
    });
  });

  it("拒绝 runtime 覆盖动态装配字段", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "runtime/base.yaml", (text) => `${text}\nrules: []\n`);
      const error = captureDiagnostics(configRoot);

      expectCode(error, "CFG_RUNTIME_OWNED_FIELD");
      expect(
        error.diagnostics.some(
          ({ source }) =>
            source?.file.endsWith("runtime/base.yaml") === true && source.path === "rules",
        ),
      ).toBe(true);
    });
  });

  it("解析并校验 raw 规则目标", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "routing/modules/ai.yaml", (text) =>
        text.replace(
          "      - { source: metacubex_geosite, name: category-ai-chat-!cn }",
          `      - { source: metacubex_geosite, name: category-ai-chat-!cn }
    rules:
      - raw: "AND,((PROCESS-NAME,codex),(NETWORK,tcp)),🤖 AI 服务"`,
        ),
      );

      const project = compileProject(configRoot);
      expect(project.rules).toContainEqual({
        kind: "raw",
        value: "AND,((PROCESS-NAME,codex),(NETWORK,tcp)),🤖 AI 服务",
        target: "ai_service",
      });
    });
  });

  it("拒绝 raw 规则的未知、缺失和不一致目标", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "routing/modules/ai.yaml", (text) =>
        text.replace(
          "      - { source: metacubex_geosite, name: category-ai-chat-!cn }",
          `      - { source: metacubex_geosite, name: category-ai-chat-!cn }
    rules:
      - raw: "PROCESS-NAME,codex,不存在的策略组"
      - raw: "CUSTOM-RULE,payload"
      - raw: "PROCESS-NAME,codex,🤖 AI 服务"
        target: private`,
        ),
      );
      const error = captureDiagnostics(configRoot);

      expectCode(error, "CFG_UNKNOWN_REFERENCE");
      expectCode(error, "CFG_RAW_RULE_TARGET_REQUIRED");
      expectCode(error, "CFG_RAW_RULE_TARGET_MISMATCH");
    });
  });

  it("拒绝用 raw 绕过 RULE-SET 与 fallback 的结构化装配", () => {
    withConfigWorkspace((configRoot) => {
      transform(configRoot, "routing/modules/ai.yaml", (text) =>
        text.replace(
          "      - { source: metacubex_geosite, name: category-ai-chat-!cn }",
          `      - { source: metacubex_geosite, name: category-ai-chat-!cn }
    rules:
      - raw: "RULE-SET,openai,🤖 AI 服务"
      - raw: "MATCH,🤖 AI 服务"`,
        ),
      );
      const error = captureDiagnostics(configRoot);

      expect(
        error.diagnostics.filter(({ code }) => code === "CFG_RAW_RULE_STRUCTURED_REQUIRED"),
      ).toHaveLength(2);
    });
  });
});

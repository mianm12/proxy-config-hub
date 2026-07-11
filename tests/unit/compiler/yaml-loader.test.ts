import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseYamlSchema } from "../../../src/compiler/schema/parse-schema.ts";
import { manifestSchema } from "../../../src/compiler/schema/raw/manifest.ts";
import {
  decodeYamlUtf8,
  loadYamlFile,
  parseYamlSource,
} from "../../../src/compiler/yaml/load-yaml.ts";
import { resolveConfigPath } from "../../../src/compiler/yaml/resolve-config-path.ts";
import { ConfigCompilationError } from "../../../src/domain/diagnostics/diagnostic.ts";

function captureCompilationError(operation: () => unknown): ConfigCompilationError {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigCompilationError);
    return error as ConfigCompilationError;
  }

  throw new Error("期望操作抛出 ConfigCompilationError");
}

describe("YAML loader", () => {
  it("按 YAML 1.2 解析并保留字段位置", () => {
    const source = parseYamlSource(
      "config/runtime/example.yaml",
      "enabled: true\nrelease-date: 2026-07-11\n",
    );

    expect(source.value).toEqual({ enabled: true, "release-date": "2026-07-11" });
    expect(source.locate(["enabled"])).toEqual({
      file: "config/runtime/example.yaml",
      line: 1,
      column: 10,
      path: "enabled",
    });
  });

  it("拒绝 duplicate key 和多文档输入", () => {
    const duplicate = captureCompilationError(() =>
      parseYamlSource("duplicate.yaml", "value: 1\nvalue: 2\n"),
    );
    const multiple = captureCompilationError(() =>
      parseYamlSource("multiple.yaml", "value: 1\n---\nvalue: 2\n"),
    );

    expect(duplicate.diagnostics.map(({ code }) => code)).toContain("CFG_YAML_DUPLICATE_KEY");
    expect(multiple.diagnostics.map(({ code }) => code)).toContain("CFG_YAML_MULTIPLE_DOCUMENTS");
  });

  it("拒绝 anchor、alias、merge key 和显式 tag", () => {
    const reused = captureCompilationError(() =>
      parseYamlSource(
        "reuse.yaml",
        "base: &base\n  value: 1\ncopy:\n  <<: *base\ntagged: !custom value\n",
      ),
    );
    const codes = reused.diagnostics.map(({ code }) => code);

    expect(codes).toContain("CFG_YAML_ANCHOR_FORBIDDEN");
    expect(codes).toContain("CFG_YAML_ALIAS_FORBIDDEN");
    expect(codes).toContain("CFG_YAML_MERGE_FORBIDDEN");
    expect(codes).toContain("CFG_YAML_TAG_FORBIDDEN");
    expect(reused.diagnostics.some(({ source }) => source?.path === "copy.<<")).toBe(true);
  });

  it("拒绝非法 UTF-8", () => {
    const error = captureCompilationError(() =>
      decodeYamlUtf8("invalid.yaml", new Uint8Array([0xc3, 0x28])),
    );

    expect(error.diagnostics[0]?.code).toBe("CFG_YAML_INVALID_UTF8");
  });

  it("把文件读取失败转换为结构化诊断", () => {
    const error = captureCompilationError(() => loadYamlFile("/missing/config.yaml"));

    expect(error.diagnostics[0]).toMatchObject({
      code: "CFG_YAML_READ_ERROR",
      source: { file: "/missing/config.yaml" },
    });
  });

  it("限制 manifest source 只能位于 config 根目录", () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "proxy-config-path-"));
    const configRoot = path.join(workspace, "config");
    const outside = path.join(workspace, "outside.yaml");
    fs.mkdirSync(path.join(configRoot, "runtime"), { recursive: true });
    fs.writeFileSync(path.join(configRoot, "runtime", "base.yaml"), "mode: rule\n");
    fs.writeFileSync(outside, "mode: direct\n");
    fs.symlinkSync(outside, path.join(configRoot, "runtime", "outside.yaml"));

    try {
      expect(
        resolveConfigPath(configRoot, "runtime/base.yaml", {
          file: "config/manifest.yaml",
          path: "runtime[0].source",
        }),
      ).toBe(path.join(configRoot, "runtime", "base.yaml"));

      const traversal = captureCompilationError(() =>
        resolveConfigPath(configRoot, "../outside.yaml", { file: "config/manifest.yaml" }),
      );
      const symlink = captureCompilationError(() =>
        resolveConfigPath(configRoot, "runtime/outside.yaml", {
          file: "config/manifest.yaml",
        }),
      );

      expect(traversal.diagnostics[0]?.code).toBe("CFG_PATH_INVALID");
      expect(symlink.diagnostics[0]?.code).toBe("CFG_PATH_SYMLINK_OUTSIDE_ROOT");
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("把严格 schema 错误映射回字段路径", () => {
    const source = parseYamlSource(
      "config/manifest.yaml",
      [
        "schema-version: 2",
        "unexpected: true",
        "runtime: []",
        "nodes:",
        "  catalog: nodes/catalog.yaml",
        "  routing-regions: nodes/routing-regions.yaml",
        "  chains: nodes/chains.yaml",
        "routing:",
        "  group-templates: routing/group-templates.yaml",
        "  provider-sources: routing/provider-sources.yaml",
        "  modules: [routing/modules/core.yaml]",
        "  group-layout: [{ group: fallback }]",
        "  rule-pipeline: [{ fallback: fallback }]",
        "rename: { profiles: rename/profiles.yaml }",
        "deployment: { channel: v2, public-base-url: null }",
        "",
      ].join("\n"),
    );
    const error = captureCompilationError(() => parseYamlSchema(source, manifestSchema));
    const unexpected = error.diagnostics.find(({ source: location }) =>
      location?.path?.endsWith("unexpected"),
    );

    expect(unexpected?.source).toMatchObject({
      file: "config/manifest.yaml",
      line: 2,
      path: "unexpected",
    });
  });
});

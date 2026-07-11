import fs from "node:fs";

import {
  isAlias,
  isMap,
  isNode,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
  type Node,
} from "yaml";

import {
  ConfigCompilationError,
  type Diagnostic,
  type DiagnosticSource,
} from "../../domain/diagnostics/diagnostic.ts";
import { YamlSource, formatSourcePath, type SourcePath } from "./yaml-source.ts";

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

/** 把字节严格解码为 UTF-8；非法序列不能静默替换成 U+FFFD。 */
function decodeYamlUtf8(file: string, bytes: Uint8Array): string {
  try {
    return UTF8_DECODER.decode(bytes);
  } catch (error) {
    throw new ConfigCompilationError([
      {
        code: "CFG_YAML_INVALID_UTF8",
        severity: "error",
        message: "文件不是合法 UTF-8",
        source: { file },
        context: { cause: error instanceof Error ? error.message : String(error) },
      },
    ]);
  }
}

function sourceForNode(
  file: string,
  lineCounter: LineCounter,
  node: Node,
  path: SourcePath,
): DiagnosticSource {
  const formattedPath = formatSourcePath(path);
  if (!node.range) {
    return { file, ...(formattedPath === undefined ? {} : { path: formattedPath }) };
  }

  const { line, col } = lineCounter.linePos(node.range[0]);
  return {
    file,
    line,
    column: col,
    ...(formattedPath === undefined ? {} : { path: formattedPath }),
  };
}

function inspectNode(
  file: string,
  lineCounter: LineCounter,
  node: Node | null,
  path: SourcePath,
  diagnostics: Diagnostic[],
): void {
  if (!node) {
    return;
  }

  const source = sourceForNode(file, lineCounter, node, path);

  if (isAlias(node)) {
    diagnostics.push({
      code: "CFG_YAML_ALIAS_FORBIDDEN",
      severity: "error",
      message: "禁止 YAML alias；请使用项目模板表达复用",
      source,
    });
    return;
  }

  if ("anchor" in node && typeof node.anchor === "string") {
    diagnostics.push({
      code: "CFG_YAML_ANCHOR_FORBIDDEN",
      severity: "error",
      message: "禁止 YAML anchor；请使用项目模板表达复用",
      source,
    });
  }

  if (node.tag !== undefined) {
    diagnostics.push({
      code: "CFG_YAML_TAG_FORBIDDEN",
      severity: "error",
      message: `禁止显式 YAML tag: ${node.tag}`,
      source,
    });
  }

  if (isMap(node)) {
    for (const pair of node.items) {
      const key = pair.key;
      const value = pair.value;
      const keyValue = isScalar(key) && typeof key.value === "string" ? key.value : undefined;
      const childPath = keyValue === undefined ? path : [...path, keyValue];

      if (keyValue === "<<" && isNode(key)) {
        diagnostics.push({
          code: "CFG_YAML_MERGE_FORBIDDEN",
          severity: "error",
          message: "禁止 YAML merge key；请使用项目模板表达复用",
          source: sourceForNode(file, lineCounter, key, childPath),
        });
      }

      if (isNode(key)) {
        inspectNode(file, lineCounter, key, childPath, diagnostics);
      }
      if (isNode(value)) {
        inspectNode(file, lineCounter, value, childPath, diagnostics);
      }
    }
    return;
  }

  if (isSeq(node)) {
    node.items.forEach((item, index) => {
      if (isNode(item)) {
        inspectNode(file, lineCounter, item, [...path, index], diagnostics);
      }
    });
  }
}

function parseErrorCode(code: string): string {
  if (code === "DUPLICATE_KEY") {
    return "CFG_YAML_DUPLICATE_KEY";
  }
  if (code === "MULTIPLE_DOCS") {
    return "CFG_YAML_MULTIPLE_DOCUMENTS";
  }
  return "CFG_YAML_PARSE_ERROR";
}

/** 解析一份 YAML 1.2 单文档，并保留 AST/source location。 */
function parseYamlSource(file: string, sourceText: string): YamlSource {
  const lineCounter = new LineCounter();
  const document = parseDocument(sourceText, {
    version: "1.2",
    schema: "core",
    strict: true,
    uniqueKeys: true,
    stringKeys: true,
    merge: false,
    customTags: [],
    resolveKnownTags: false,
    lineCounter,
    prettyErrors: false,
  });
  const diagnostics: Diagnostic[] = [...document.errors, ...document.warnings].map((error) => {
    const position = error.linePos?.[0];
    return {
      code: parseErrorCode(error.code),
      severity: "error",
      message: error.message,
      source: {
        file,
        ...(position === undefined ? {} : { line: position.line, column: position.col }),
      },
    };
  });

  if (document.contents) {
    inspectNode(file, lineCounter, document.contents, [], diagnostics);
  }

  if (diagnostics.length > 0) {
    throw new ConfigCompilationError(diagnostics);
  }

  const value: unknown = document.toJS({ maxAliasCount: 0 });
  return new YamlSource(file, value, document, lineCounter);
}

/** 从文件系统读取并严格解析 YAML。 */
function loadYamlFile(file: string): YamlSource {
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(file);
  } catch (error) {
    throw new ConfigCompilationError([
      {
        code: "CFG_YAML_READ_ERROR",
        severity: "error",
        message: "无法读取 YAML 文件",
        source: { file },
        context: { cause: error instanceof Error ? error.message : String(error) },
      },
    ]);
  }

  return parseYamlSource(file, decodeYamlUtf8(file, bytes));
}

export { decodeYamlUtf8, loadYamlFile, parseYamlSource };

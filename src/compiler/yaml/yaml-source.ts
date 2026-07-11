import type { Document } from "yaml";
import { isNode, LineCounter } from "yaml";

import type { DiagnosticSource } from "../../domain/diagnostics/diagnostic.js";

type SourcePath = readonly (string | number)[];

/** 将结构化路径格式化为稳定的点号/下标表达。 */
function formatSourcePath(path: SourcePath): string | undefined {
  if (path.length === 0) {
    return undefined;
  }

  return path
    .map((segment, index) =>
      typeof segment === "number" ? `[${String(segment)}]` : `${index === 0 ? "" : "."}${segment}`,
    )
    .join("");
}

/** 保存 YAML AST 与行号索引，为 schema/语义诊断提供最近声明位置。 */
class YamlSource {
  readonly file: string;
  readonly value: unknown;

  readonly #document: Document.Parsed;
  readonly #lineCounter: LineCounter;

  constructor(file: string, value: unknown, document: Document.Parsed, lineCounter: LineCounter) {
    this.file = file;
    this.value = value;
    this.#document = document;
    this.#lineCounter = lineCounter;
  }

  /**
   * 查找字段本身或最近父节点的位置。Zod 指向缺失字段时会自然回退到父对象。
   */
  locate(path: SourcePath = []): DiagnosticSource {
    for (let length = path.length; length >= 0; length -= 1) {
      const candidatePath = path.slice(0, length);
      const candidate =
        candidatePath.length === 0
          ? this.#document.contents
          : this.#document.getIn(candidatePath, true);

      if (isNode(candidate) && candidate.range) {
        const { line, col } = this.#lineCounter.linePos(candidate.range[0]);
        const formattedPath = formatSourcePath(path);

        return {
          file: this.file,
          line,
          column: col,
          ...(formattedPath === undefined ? {} : { path: formattedPath }),
        };
      }
    }

    const formattedPath = formatSourcePath(path);
    return {
      file: this.file,
      ...(formattedPath === undefined ? {} : { path: formattedPath }),
    };
  }
}

export { YamlSource, formatSourcePath };
export type { SourcePath };

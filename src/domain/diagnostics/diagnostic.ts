type DiagnosticSeverity = "warning" | "error";

interface DiagnosticSource {
  readonly file: string;
  readonly line?: number;
  readonly column?: number;
  readonly path?: string;
}

interface Diagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly source?: DiagnosticSource;
  readonly context?: Readonly<Record<string, unknown>>;
}

/** 聚合配置编译诊断，禁止调用方丢失结构化错误后只保留字符串。 */
class ConfigCompilationError extends Error {
  readonly diagnostics: readonly Diagnostic[];

  constructor(diagnostics: readonly Diagnostic[]) {
    super(diagnostics.map(formatDiagnostic).join("\n"));
    this.name = "ConfigCompilationError";
    this.diagnostics = diagnostics;
  }
}

/**
 * 生成人类可读的单行诊断；结构化字段仍保留在 Diagnostic 上供测试和工具消费。
 */
function formatDiagnostic(diagnostic: Diagnostic): string {
  const source = diagnostic.source;
  const location = source
    ? `${source.file}${
        source.line === undefined ? "" : `:${String(source.line)}:${String(source.column ?? 1)}`
      }${source.path === undefined ? "" : ` (${source.path})`}`
    : "<unknown>";

  return `${location} [${diagnostic.code}] ${diagnostic.message}`;
}

export { ConfigCompilationError, formatDiagnostic };
export type { Diagnostic, DiagnosticSeverity, DiagnosticSource };

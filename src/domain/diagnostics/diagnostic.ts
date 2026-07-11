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

export type { Diagnostic, DiagnosticSeverity, DiagnosticSource };

import {
  ConfigCompilationError,
  type Diagnostic,
  type DiagnosticSource,
} from "../../domain/diagnostics/diagnostic.ts";

class DiagnosticCollector {
  readonly #diagnostics: Diagnostic[] = [];

  error(
    code: string,
    message: string,
    source: DiagnosticSource,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    this.#diagnostics.push({
      code,
      severity: "error",
      message,
      source,
      ...(context === undefined ? {} : { context }),
    });
  }

  throwIfAny(): void {
    if (this.#diagnostics.length > 0) {
      throw new ConfigCompilationError(this.#diagnostics);
    }
  }
}

export { DiagnosticCollector };

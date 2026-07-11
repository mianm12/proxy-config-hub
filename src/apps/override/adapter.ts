import type { Diagnostic } from "../../domain/diagnostics/diagnostic.ts";
import { compileOverride } from "../../runtime/override/index.ts";
import type { MihomoConfig, OverrideProject } from "../../runtime/override/index.ts";

interface OverrideContext {
  readonly profileName?: string;
}

type DiagnosticReporter = (diagnostic: Diagnostic) => void;

/** 三个 override 宿主的公共适配边界；宿主上下文不得进入领域流水线。 */
function runOverrideAdapter(
  input: unknown,
  context: OverrideContext,
  project: OverrideProject,
  reportDiagnostic: DiagnosticReporter = () => undefined,
): MihomoConfig {
  void context.profileName;
  const result = compileOverride(input, project);
  result.diagnostics.forEach(reportDiagnostic);
  return result.config;
}

export { runOverrideAdapter };
export type { DiagnosticReporter, OverrideContext };

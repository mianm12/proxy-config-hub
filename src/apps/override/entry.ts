import { overrideProject } from "virtual:project-ir";

import { formatDiagnostic } from "../../domain/diagnostics/diagnostic.ts";
import type { MihomoConfig } from "../../runtime/override/index.ts";
import { runOverrideAdapter } from "./adapter.ts";

function main(config: unknown, profileName?: string): MihomoConfig {
  const context = profileName === undefined ? {} : { profileName };
  return runOverrideAdapter(config, context, overrideProject, (diagnostic) => {
    console.warn(`[override] ${formatDiagnostic(diagnostic)}`);
  });
}

export { main };

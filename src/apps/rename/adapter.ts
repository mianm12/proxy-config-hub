import type { RenameProfileIr } from "../../compiler/ir/project-ir.ts";
import type { Diagnostic } from "../../domain/diagnostics/diagnostic.ts";
import type { ProxyNode, RegionDefinition } from "../../domain/node/index.ts";
import { renameProxies } from "../../runtime/rename/index.ts";
import { resolveRenameProfile, type RenameArguments } from "./profile-arguments.ts";

interface RenameRuntimeData {
  readonly nodeCatalog: readonly RegionDefinition[];
  readonly renameProfiles: readonly RenameProfileIr[];
}

type DiagnosticReporter = (diagnostic: Diagnostic) => void;

/** Sub-Store adapter 内核；宿主全局变量在 bundle entry 读取后显式传入。 */
function runRenameAdapter(
  proxies: readonly ProxyNode[],
  targetPlatform: unknown,
  context: unknown,
  argumentsValue: RenameArguments,
  runtime: RenameRuntimeData,
  reportDiagnostic: DiagnosticReporter = () => undefined,
): readonly ProxyNode[] {
  void targetPlatform;
  void context;
  const profile = resolveRenameProfile(argumentsValue, runtime.renameProfiles);
  const result = renameProxies(proxies, profile, runtime.nodeCatalog);
  result.diagnostics.forEach(reportDiagnostic);
  return result.proxies;
}

export { runRenameAdapter };
export type { DiagnosticReporter, RenameRuntimeData };

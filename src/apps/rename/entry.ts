import { nodeCatalog, renameDefaultProfile, renameProfiles } from "virtual:project-ir";

import { formatDiagnostic } from "../../domain/diagnostics/diagnostic.ts";
import type { ProxyNode } from "../../domain/node/index.ts";
import type { GeoIsoResolver } from "../../runtime/rename/index.ts";
import { runRenameAdapter } from "./adapter.ts";
import type { RenameArguments } from "./profile-arguments.ts";

function readHostArguments(): RenameArguments {
  const hostGlobal = globalThis as typeof globalThis & { $arguments?: unknown };
  const value = hostGlobal.$arguments;
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function readHostGeoResolver(): GeoIsoResolver | undefined {
  const hostGlobal = globalThis as typeof globalThis & {
    ProxyUtils?: { readonly getISO?: unknown };
  };
  const getISO = hostGlobal.ProxyUtils?.getISO;
  return typeof getISO === "function"
    ? (name) => (getISO as (value: string) => unknown)(name)
    : undefined;
}

function operator(
  proxies: readonly ProxyNode[],
  targetPlatform?: unknown,
  context?: unknown,
): Promise<readonly ProxyNode[]> {
  return Promise.resolve(
    runRenameAdapter(
      Array.isArray(proxies) ? proxies : [],
      targetPlatform,
      context,
      readHostArguments(),
      { nodeCatalog, renameDefaultProfile, renameProfiles },
      (diagnostic) => {
        console.warn(`[rename] ${formatDiagnostic(diagnostic)}`);
      },
      readHostGeoResolver(),
    ),
  );
}

export { operator };

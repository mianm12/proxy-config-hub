import type { Diagnostic } from "../../domain/diagnostics/diagnostic.ts";
import type { ProxyNode } from "../../domain/node/types.ts";

interface RenameResult {
  readonly proxies: readonly ProxyNode[];
  readonly diagnostics: readonly Diagnostic[];
}

type GeoIsoResolver = (name: string) => unknown;

export type { GeoIsoResolver, RenameResult };

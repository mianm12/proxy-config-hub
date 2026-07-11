import type { Diagnostic } from "../../domain/diagnostics/diagnostic.ts";
import type { ProjectIr } from "../../compiler/ir/project-ir.ts";
import type { ProxyNode } from "../../domain/node/index.ts";

type MihomoConfig = Readonly<Record<string, unknown>>;

type OverrideProject = Pick<
  ProjectIr,
  | "runtimePlan"
  | "nodeCatalog"
  | "routingRegions"
  | "chains"
  | "groups"
  | "groupLayout"
  | "providers"
  | "rules"
  | "fallbackGroup"
>;

interface MihomoProxyGroup {
  readonly name: string;
  readonly type: string;
  readonly proxies: readonly string[];
  readonly [key: string]: unknown;
}

interface OverrideResult {
  readonly config: MihomoConfig;
  readonly diagnostics: readonly Diagnostic[];
}

interface NamedProxy {
  readonly proxy: ProxyNode;
  readonly index: number;
  readonly name: string;
}

export type { MihomoConfig, MihomoProxyGroup, NamedProxy, OverrideProject, OverrideResult };

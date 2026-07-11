import type { Diagnostic } from "../diagnostics/diagnostic.ts";

type RegionConfidence = "flag" | "name" | "code" | "alias" | "fallback";

interface NodeMetadata {
  readonly originalName: string;
  readonly region: string;
  readonly multiplier?: number;
  readonly multiplierLabel?: string;
  readonly tags: readonly string[];
  readonly confidence: RegionConfidence;
  readonly diagnostics: readonly Diagnostic[];
}

interface ProxyNode {
  readonly name?: unknown;
  readonly [key: string]: unknown;
}

export type { NodeMetadata, ProxyNode, RegionConfidence };

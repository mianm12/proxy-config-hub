import type { Diagnostic } from "../diagnostics/diagnostic.ts";
import type { RegionConfidence, RegionDefinition } from "./types.ts";

interface RegionMatch {
  readonly region: RegionDefinition;
  readonly confidence: RegionConfidence;
  readonly signal: string;
  readonly index: number;
  readonly priority: number;
}

interface RegionResolution {
  readonly region: RegionDefinition | undefined;
  readonly confidence: RegionConfidence;
  readonly diagnostics: readonly Diagnostic[];
}

function findText(name: string, signal: string): number {
  return name.toLocaleLowerCase("en-US").indexOf(signal.toLocaleLowerCase("en-US"));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findCode(name: string, code: string): number {
  const pattern = new RegExp(`(?:^|[^A-Z])(${escapeRegExp(code)})(?=$|[^A-Z])`, "iu");
  const match = pattern.exec(name);
  if (match === null) return -1;
  return match.index + (match[0].length - (match[1]?.length ?? 0));
}

function bestSignal(
  name: string,
  region: RegionDefinition,
  confidence: RegionConfidence,
  priority: number,
  signals: readonly string[],
  finder: (nodeName: string, signal: string) => number,
): RegionMatch | undefined {
  const matches = signals
    .map((signal) => ({ signal, index: finder(name, signal) }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index || right.signal.length - left.signal.length);
  const selected = matches[0];
  return selected === undefined
    ? undefined
    : { region, confidence, priority, signal: selected.signal, index: selected.index };
}

function collectRegionMatches(
  name: string,
  catalog: readonly RegionDefinition[],
): readonly RegionMatch[] {
  return catalog.flatMap((region) => {
    const candidates = [
      bestSignal(name, region, "flag", 0, [region.emoji], findText),
      bestSignal(
        name,
        region,
        "name",
        1,
        [region.name, ...region.names.zh, ...region.names.en],
        findText,
      ),
      bestSignal(name, region, "code", 2, region.codes, findCode),
      bestSignal(name, region, "alias", 3, [...region.aliases, ...region.cities], findText),
    ].filter((match): match is RegionMatch => match !== undefined);
    return candidates;
  });
}

function resolveRegion(name: string, catalog: readonly RegionDefinition[]): RegionResolution {
  const matches = [...collectRegionMatches(name, catalog)].sort(
    (left, right) =>
      left.priority - right.priority ||
      left.index - right.index ||
      right.signal.length - left.signal.length ||
      left.region.id.localeCompare(right.region.id),
  );
  const selected = matches[0];
  if (selected === undefined) {
    return { region: undefined, confidence: "fallback", diagnostics: [] };
  }

  const conflictingRegions = [...new Set(matches.map(({ region }) => region.id))].filter(
    (regionId) => regionId !== selected.region.id,
  );
  const diagnostics: Diagnostic[] =
    conflictingRegions.length === 0
      ? []
      : [
          {
            code: "NODE_REGION_CONFLICT",
            severity: "warning",
            message: `节点名同时命中多个地区，选择 ${selected.region.id}`,
            context: {
              name,
              selected: selected.region.id,
              conflicts: conflictingRegions,
            },
          },
        ];

  return {
    region: selected.region,
    confidence: selected.confidence,
    diagnostics,
  };
}

export { collectRegionMatches, resolveRegion };
export type { RegionMatch, RegionResolution };

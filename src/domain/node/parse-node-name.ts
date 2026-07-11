import type { RegionIr } from "../../compiler/ir/project-ir.ts";
import { extractMultiplier } from "./multiplier.ts";
import { resolveRegion } from "./region-matcher.ts";
import { extractTags } from "./tags.ts";
import type { NodeMetadata } from "./types.ts";

/** 将节点名解析为 override 与 rename 共用的规范元数据。 */
function parseNodeName(
  name: string,
  catalog: readonly RegionIr[],
  configuredTags: readonly string[] = [],
): NodeMetadata {
  const region = resolveRegion(name, catalog);
  const multiplier = extractMultiplier(name);
  const tags = extractTags(name, configuredTags).map(({ value }) => value);

  return {
    originalName: name,
    region: region.region?.id ?? "OTHER",
    ...(multiplier === undefined
      ? {}
      : { multiplier: multiplier.value, multiplierLabel: multiplier.label }),
    tags,
    confidence: region.confidence,
    diagnostics: region.diagnostics,
  };
}

export { parseNodeName };

import type { RenameProfileIr } from "../../compiler/ir/project-ir.ts";
import type { Diagnostic } from "../../domain/diagnostics/diagnostic.ts";
import { parseNodeName, type ProxyNode, type RegionDefinition } from "../../domain/node/index.ts";
import type { RenameResult } from "./types.ts";

interface RenameCandidate {
  readonly proxy: ProxyNode;
  readonly baseName: string;
}

function buildBaseName(
  profile: RenameProfileIr,
  region: RegionDefinition,
  tags: readonly string[],
  multiplierLabel: string | undefined,
): string {
  const pieces = [
    ...(profile.prefixPosition === "first" ? [profile.prefix] : []),
    ...(profile.addFlag ? [region.emoji] : []),
    region.name,
    ...tags,
    ...(profile.preserveMultiplier && multiplierLabel !== undefined ? [multiplierLabel] : []),
    ...(profile.prefixPosition === "last" ? [profile.prefix] : []),
  ].filter((piece) => piece.length > 0);

  return pieces.join(profile.separator);
}

/** 纯函数重命名节点；不修改输入数组或代理对象。 */
function renameProxies(
  proxies: readonly ProxyNode[],
  profile: RenameProfileIr,
  catalog: readonly RegionDefinition[],
): RenameResult {
  const regions = new Map(catalog.map((region) => [region.id, region]));
  const diagnostics: Diagnostic[] = [];
  const candidates: RenameCandidate[] = [];

  proxies.forEach((proxy, index) => {
    if (typeof proxy.name !== "string" || proxy.name.length === 0) {
      diagnostics.push({
        code: "RENAME_INVALID_NAME",
        severity: "warning",
        message: "节点缺少非空字符串 name，已跳过",
        context: { index },
      });
      return;
    }

    const metadata = parseNodeName(proxy.name, catalog, profile.preserveTags);
    diagnostics.push(...metadata.diagnostics);
    const region = regions.get(metadata.region);
    if (region === undefined) {
      diagnostics.push({
        code: "RENAME_UNKNOWN_REGION",
        severity: "warning",
        message: `节点地区无法识别，已跳过: ${proxy.name}`,
        context: { index, name: proxy.name },
      });
      return;
    }

    const baseName = buildBaseName(profile, region, metadata.tags, metadata.multiplierLabel);
    candidates.push({ proxy, baseName });
  });

  const totals = new Map<string, number>();
  for (const candidate of candidates) {
    totals.set(candidate.baseName, (totals.get(candidate.baseName) ?? 0) + 1);
  }
  const indexes = new Map<string, number>();
  const renamed = candidates.map(({ proxy, baseName }) => {
    const index = (indexes.get(baseName) ?? 0) + 1;
    indexes.set(baseName, index);
    const needsSequence = !profile.collapseSingle || (totals.get(baseName) ?? 0) > 1;
    const name = needsSequence ? `${baseName} ${String(index).padStart(2, "0")}` : baseName;
    return { ...proxy, name };
  });

  return { proxies: renamed, diagnostics };
}

export { renameProxies };

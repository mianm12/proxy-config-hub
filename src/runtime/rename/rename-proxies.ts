import type { RenameFieldIr, RenameProfileIr } from "../../compiler/ir/project-ir.ts";
import { ConfigCompilationError, type Diagnostic } from "../../domain/diagnostics/diagnostic.ts";
import {
  extractMultiplier,
  isSubscriptionMetadataName,
  resolveRegion,
  type ProxyNode,
  type RegionDefinition,
} from "../../domain/node/index.ts";
import { hasRenameControlCharacter } from "../../domain/rename/options.ts";
import { extractTraits } from "./traits.ts";
import type { GeoIsoResolver, RenameResult } from "./types.ts";

interface RenameValues {
  readonly subscription: string | undefined;
  readonly flag: string;
  readonly iso: string;
  readonly protocol: string;
  readonly traits: readonly string[];
  readonly multiplier: string | undefined;
}

interface RenameCandidate {
  readonly proxy: ProxyNode;
  readonly values: RenameValues;
  readonly baseName: string;
  readonly sourceIndex: number;
}

type ReadableStringResult =
  { readonly kind: "value"; readonly value: string } | { readonly kind: "missing" | "invalid" };

interface SubscriptionResolution {
  readonly value: string | undefined;
  readonly invalidFields: readonly string[];
}

const SUBSCRIPTION_FIELDS = [
  "_subDisplayName",
  "_subName",
  "_collectionDisplayName",
  "_collectionName",
] as const;

function readString(value: unknown): ReadableStringResult {
  if (typeof value !== "string") return { kind: "missing" };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { kind: "missing" };
  if (hasRenameControlCharacter(trimmed)) return { kind: "invalid" };
  return { kind: "value", value: trimmed.replace(/\s+/gu, " ") };
}

function resolveSubscription(proxy: ProxyNode, fallback: string | null): SubscriptionResolution {
  const invalidFields: string[] = [];
  for (const field of SUBSCRIPTION_FIELDS) {
    const result = readString(proxy[field]);
    if (result.kind === "value") return { value: result.value, invalidFields };
    if (result.kind === "invalid") invalidFields.push(field);
  }

  if (fallback === null) return { value: undefined, invalidFields };
  const result = readString(fallback);
  if (result.kind === "invalid") invalidFields.push("subscriptionFallback");
  return {
    value: result.kind === "value" ? result.value : undefined,
    invalidFields,
  };
}

function normalizeRegionCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLocaleUpperCase("en-US");
  return /^[A-Z]{2}$/u.test(normalized) ? normalized : undefined;
}

function isoToFlag(iso: string): string {
  if (iso === "ZZ") return "🏳️";
  return String.fromCodePoint(0x1f1e6 + iso.charCodeAt(0) - 65, 0x1f1e6 + iso.charCodeAt(1) - 65);
}

function resolveIso(
  name: string | undefined,
  catalog: readonly RegionDefinition[],
  hostResolver: GeoIsoResolver | undefined,
  diagnostics: Diagnostic[],
  index: number,
): string {
  if (name !== undefined && hostResolver !== undefined) {
    try {
      const rawIso = hostResolver(name);
      const iso = normalizeRegionCode(rawIso);
      if (iso !== undefined) return iso;
      if (rawIso !== undefined) {
        diagnostics.push({
          code: "RENAME_GEO_ISO_INVALID",
          severity: "warning",
          message: "ProxyUtils 返回了非法地区代码，改用内置 catalog",
          context: { index, name, iso: rawIso },
        });
      }
    } catch (error) {
      diagnostics.push({
        code: "RENAME_GEO_RESOLVER_FAILED",
        severity: "warning",
        message: "ProxyUtils 地区识别失败，改用内置 catalog",
        context: { index, name, error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  if (name !== undefined) {
    const resolution = resolveRegion(name, catalog);
    diagnostics.push(...resolution.diagnostics);
    const catalogIso = normalizeRegionCode(resolution.region?.id ?? resolution.region?.codes[0]);
    if (catalogIso !== undefined) return catalogIso;
  }

  diagnostics.push({
    code: "RENAME_UNKNOWN_REGION",
    severity: "warning",
    message: `节点地区无法识别，使用 ZZ: ${name ?? "<缺少名称>"}`,
    context: { index, ...(name === undefined ? {} : { name }) },
  });
  return "ZZ";
}

function wrap(value: string, field: RenameFieldIr, brackets: ReadonlySet<RenameFieldIr>): string {
  return brackets.has(field) ? `[${value}]` : value;
}

function renderName(
  values: RenameValues,
  profile: RenameProfileIr,
  sequence: string | undefined,
): string {
  const brackets = new Set(profile.brackets);
  const pieces: string[] = [];
  for (const field of profile.fields) {
    if (field === "sequence") {
      if (sequence !== undefined) pieces.push(wrap(sequence, field, brackets));
      continue;
    }
    if (field === "traits") {
      if (values.traits.length === 0) continue;
      if (brackets.has(field)) {
        pieces.push(`[${values.traits.join(profile.separator)}]`);
      } else {
        pieces.push(...values.traits);
      }
      continue;
    }
    const value = values[field];
    if (value !== undefined) pieces.push(wrap(value, field, brackets));
  }
  return pieces.join(profile.separator);
}

function renderCandidateName(
  candidate: RenameCandidate,
  profile: RenameProfileIr,
  sequence: string | undefined,
): string {
  const name = renderName(candidate.values, profile, sequence);
  if (name.length > 0) return name;

  throw new ConfigCompilationError([
    {
      code: "RENAME_EMPTY_OUTPUT_NAME",
      severity: "error",
      message: "rename 生成了空节点名",
      context: { index: candidate.sourceIndex, profile: profile.id },
    },
  ]);
}

function renderCandidates(
  candidates: readonly RenameCandidate[],
  profile: RenameProfileIr,
): readonly ProxyNode[] {
  const totals = new Map<string, number>();
  for (const candidate of candidates) {
    totals.set(candidate.baseName, (totals.get(candidate.baseName) ?? 0) + 1);
  }

  const unsequencedNames = new Map<RenameCandidate, string>();
  if (profile.sequence === "duplicates") {
    for (const candidate of candidates) {
      if ((totals.get(candidate.baseName) ?? 0) !== 1) continue;
      unsequencedNames.set(candidate, renderCandidateName(candidate, profile, undefined));
    }
  }

  const usedNames = new Set(unsequencedNames.values());
  const indexes = new Map<string, number>();
  return candidates.map((candidate) => {
    const unsequencedName = unsequencedNames.get(candidate);
    if (unsequencedName !== undefined) {
      return { ...candidate.proxy, name: unsequencedName };
    }

    let index = indexes.get(candidate.baseName) ?? 0;
    let name: string;
    do {
      index += 1;
      name = renderCandidateName(candidate, profile, String(index).padStart(2, "0"));
    } while (usedNames.has(name));

    indexes.set(candidate.baseName, index);
    usedNames.add(name);
    return { ...candidate.proxy, name };
  });
}

/** 纯函数重命名节点；除强确定的订阅信息项外，不删除输入代理。 */
function renameProxies(
  proxies: readonly ProxyNode[],
  profile: RenameProfileIr,
  catalog: readonly RegionDefinition[],
  hostResolver?: GeoIsoResolver,
): RenameResult {
  const diagnostics: Diagnostic[] = [];
  const candidates: RenameCandidate[] = [];

  proxies.forEach((proxy, index) => {
    const nameResult = readString(proxy.name);
    const name = nameResult.kind === "value" ? nameResult.value : undefined;
    if (name !== undefined && isSubscriptionMetadataName(name)) {
      diagnostics.push({
        code: "RENAME_SUBSCRIPTION_METADATA_SKIPPED",
        severity: "warning",
        message: `订阅信息节点已跳过: ${name}`,
        context: { index, name },
      });
      return;
    }
    if (name === undefined) {
      diagnostics.push({
        code: "RENAME_INVALID_NAME",
        severity: "warning",
        message:
          nameResult.kind === "invalid"
            ? "节点 name 包含控制字符，使用其他元数据生成名称"
            : "节点缺少非空字符串 name，使用其他元数据生成名称",
        context: { index, reason: nameResult.kind },
      });
    }

    const subscription = resolveSubscription(proxy, profile.subscriptionFallback);
    if (subscription.invalidFields.length > 0) {
      diagnostics.push({
        code: "RENAME_SUBSCRIPTION_NAME_INVALID",
        severity: "warning",
        message: "订阅名称包含控制字符，已忽略非法字段",
        context: { index, fields: subscription.invalidFields },
      });
    }
    if (subscription.value === undefined) {
      diagnostics.push({
        code: "RENAME_SUBSCRIPTION_NAME_MISSING",
        severity: "warning",
        message: "节点缺少订阅名称且未配置 fallback",
        context: { index },
      });
    }
    const protocolResult = readString(proxy["type"]);
    const protocol =
      protocolResult.kind === "value" ? protocolResult.value.toLocaleLowerCase("en-US") : undefined;
    if (protocolResult.kind !== "value") {
      diagnostics.push({
        code:
          protocolResult.kind === "invalid" ? "RENAME_PROTOCOL_INVALID" : "RENAME_PROTOCOL_MISSING",
        severity: "warning",
        message:
          protocolResult.kind === "invalid"
            ? "节点协议类型包含控制字符，使用 unknown"
            : "节点缺少协议类型，使用 unknown",
        context: { index, reason: protocolResult.kind },
      });
    }
    const iso = resolveIso(name, catalog, hostResolver, diagnostics, index);
    const values: RenameValues = {
      subscription: subscription.value,
      flag: isoToFlag(iso),
      iso,
      protocol: protocol ?? "unknown",
      traits: name === undefined ? [] : extractTraits(name, profile.extraTraits),
      multiplier: name === undefined ? undefined : extractMultiplier(name)?.label,
    };
    candidates.push({
      proxy,
      values,
      baseName: renderName(values, profile, undefined),
      sourceIndex: index,
    });
  });

  return { proxies: renderCandidates(candidates, profile), diagnostics };
}

export { renameProxies };

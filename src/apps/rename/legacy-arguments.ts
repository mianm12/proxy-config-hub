import type { RenameProfileIr } from "../../compiler/ir/project-ir.ts";
import { ConfigCompilationError } from "../../domain/diagnostics/diagnostic.ts";

type RenameArguments = Readonly<Record<string, unknown>>;

const KNOWN_ARGUMENTS = new Set([
  "profile",
  "bl",
  "blkey",
  "fgf",
  "flag",
  "name",
  "nf",
  "one",
  "noCache",
]);
const PROFILE_OVERRIDES = new Set(["fgf", "one", "noCache"]);

function argumentError(message: string): never {
  throw new ConfigCompilationError([
    { code: "RENAME_ARGUMENT_INVALID", severity: "error", message },
  ]);
}

function decodeString(value: unknown, name: string, fallback = ""): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string") argumentError(`rename 参数 ${name} 必须是字符串`);
  try {
    return decodeURIComponent(value);
  } catch {
    argumentError(`rename 参数 ${name} 不是合法 URI 编码`);
  }
}

function parseBoolean(value: unknown, name: string, fallback = false): boolean {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") argumentError(`rename 参数 ${name} 必须是布尔值`);

  const normalized = value.toLocaleLowerCase("en-US");
  if (["", "1", "true", "on"].includes(normalized)) return true;
  if (["0", "false", "off"].includes(normalized)) return false;
  argumentError(`rename 参数 ${name} 的布尔值非法: ${value}`);
}

function assertKnownArguments(argumentsValue: RenameArguments): void {
  const unknown = Object.keys(argumentsValue).filter((key) => !KNOWN_ARGUMENTS.has(key));
  if (unknown.length > 0) {
    argumentError(`不支持的 rename legacy 参数: ${unknown.join(", ")}`);
  }
}

function resolveNamedProfile(
  profileId: string,
  argumentsValue: RenameArguments,
  profiles: readonly RenameProfileIr[],
): RenameProfileIr {
  const profile = profiles.find(({ id }) => id === profileId);
  if (profile === undefined) argumentError(`未知 rename profile: ${profileId}`);

  const conflicts = Object.keys(argumentsValue).filter(
    (key) => key !== "profile" && !PROFILE_OVERRIDES.has(key),
  );
  if (conflicts.length > 0) {
    argumentError(`profile 不允许与这些 legacy 参数混用: ${conflicts.join(", ")}`);
  }

  return {
    ...profile,
    ...(argumentsValue["fgf"] === undefined
      ? {}
      : { separator: decodeString(argumentsValue["fgf"], "fgf") }),
    ...(argumentsValue["one"] === undefined
      ? {}
      : { collapseSingle: parseBoolean(argumentsValue["one"], "one") }),
  };
}

function resolveLegacyProfile(argumentsValue: RenameArguments): RenameProfileIr {
  const preserveTags = decodeString(argumentsValue["blkey"], "blkey")
    .split("+")
    .filter((tag) => tag.length > 0);

  return {
    id: "legacy",
    prefix: decodeString(argumentsValue["name"], "name"),
    prefixPosition: parseBoolean(argumentsValue["nf"], "nf") ? "first" : "last",
    separator: decodeString(argumentsValue["fgf"], "fgf", " "),
    addFlag: parseBoolean(argumentsValue["flag"], "flag"),
    preserveMultiplier: parseBoolean(argumentsValue["bl"], "bl"),
    collapseSingle: parseBoolean(argumentsValue["one"], "one"),
    preserveTags,
  };
}

function resolveRenameProfile(
  argumentsValue: RenameArguments,
  profiles: readonly RenameProfileIr[],
): RenameProfileIr {
  assertKnownArguments(argumentsValue);
  const profileId = decodeString(argumentsValue["profile"], "profile");
  return profileId.length > 0
    ? resolveNamedProfile(profileId, argumentsValue, profiles)
    : resolveLegacyProfile(argumentsValue);
}

export { resolveRenameProfile };
export type { RenameArguments };

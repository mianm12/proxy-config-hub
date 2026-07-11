import type { RenameProfileIr } from "../../compiler/ir/project-ir.ts";
import { ConfigCompilationError } from "../../domain/diagnostics/diagnostic.ts";

type RenameArguments = Readonly<Record<string, unknown>>;

const KNOWN_ARGUMENTS = new Set(["profile", "noCache"]);

function argumentError(message: string): never {
  throw new ConfigCompilationError([
    { code: "RENAME_ARGUMENT_INVALID", severity: "error", message },
  ]);
}

function decodeProfileId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    argumentError("rename 参数 profile 必须是非空字符串");
  }
  try {
    return decodeURIComponent(value);
  } catch {
    argumentError("rename 参数 profile 不是合法 URI 编码");
  }
}

function assertKnownArguments(argumentsValue: RenameArguments): void {
  const unknown = Object.keys(argumentsValue).filter((key) => !KNOWN_ARGUMENTS.has(key));
  if (unknown.length > 0) {
    argumentError(`不支持的 rename 参数: ${unknown.join(", ")}`);
  }
}

function resolveRenameProfile(
  argumentsValue: RenameArguments,
  profiles: readonly RenameProfileIr[],
): RenameProfileIr {
  assertKnownArguments(argumentsValue);
  const profileId = decodeProfileId(argumentsValue["profile"]);
  const profile = profiles.find(({ id }) => id === profileId);
  if (profile === undefined) argumentError(`未知 rename profile: ${profileId}`);
  return profile;
}

export { resolveRenameProfile };
export type { RenameArguments };

import type { RenameFieldIr, RenameProfileIr } from "../../compiler/ir/project-ir.ts";
import { ConfigCompilationError } from "../../domain/diagnostics/diagnostic.ts";
import {
  RENAME_FIELDS,
  hasRenameControlCharacter,
  inspectRenameOptions,
  isValidRenameSeparator,
  normalizeRenameText,
  type RenameOptionsIssue,
} from "../../domain/rename/options.ts";

type RenameArguments = Readonly<Record<string, unknown>>;

const KNOWN_ARGUMENTS = new Set([
  "profile",
  "fields",
  "separator",
  "brackets",
  "subscriptionFallback",
  "extraTraits",
  "sequence",
  "noCache",
]);
const RENAME_FIELD_SET = new Set<RenameFieldIr>(RENAME_FIELDS);

function argumentError(message: string): never {
  throw new ConfigCompilationError([
    { code: "RENAME_ARGUMENT_INVALID", severity: "error", message },
  ]);
}

function readArgumentString(key: string, value: unknown, allowEmpty = false): string {
  if (typeof value !== "string") argumentError(`rename 参数 ${key} 必须是字符串`);
  if (!allowEmpty && value.length === 0) argumentError(`rename 参数 ${key} 不能为空`);
  return value;
}

function parseList(key: string, value: unknown, allowEmptyList = false): readonly string[] {
  const argument = readArgumentString(key, value, allowEmptyList);
  if (allowEmptyList && argument.length === 0) return [];
  const items = argument.split(",").map((item) => item.trim());
  if (items.some((item) => item.length === 0)) {
    argumentError(`rename 参数 ${key} 包含空值`);
  }
  if (items.some(hasRenameControlCharacter)) {
    argumentError(`rename 参数 ${key} 不得包含控制字符`);
  }
  const seen = new Set<string>();
  for (const item of items) {
    const normalized = key === "extraTraits" ? item.toLocaleLowerCase("en-US") : item;
    if (seen.has(normalized)) argumentError(`rename 参数 ${key} 包含重复值: ${item}`);
    seen.add(normalized);
  }
  return items;
}

function parseFields(value: unknown): readonly RenameFieldIr[] {
  const fields = parseList("fields", value);
  const invalid = fields.find((field) => !RENAME_FIELD_SET.has(field as RenameFieldIr));
  if (invalid !== undefined) argumentError(`rename 参数 fields 包含未知字段: ${invalid}`);
  return fields as readonly RenameFieldIr[];
}

function parseBrackets(value: unknown): readonly RenameFieldIr[] {
  const brackets = parseList("brackets", value, true);
  const invalid = brackets.find((field) => !RENAME_FIELD_SET.has(field as RenameFieldIr));
  if (invalid !== undefined) argumentError(`rename 参数 brackets 包含未知字段: ${invalid}`);
  return brackets as readonly RenameFieldIr[];
}

function assertKnownArguments(argumentsValue: RenameArguments): void {
  const unknown = Object.keys(argumentsValue).filter((key) => !KNOWN_ARGUMENTS.has(key));
  if (unknown.length > 0) argumentError(`不支持的 rename 参数: ${unknown.join(", ")}`);
}

function parseSeparator(value: unknown): string {
  const separator = readArgumentString("separator", value);
  if (!isValidRenameSeparator(separator)) {
    argumentError("rename 参数 separator 不得包含控制字符");
  }
  return separator;
}

function parseSubscriptionFallback(value: unknown): string | null {
  const argument = readArgumentString("subscriptionFallback", value, true);
  if (argument.length === 0) return null;
  const normalized = normalizeRenameText(argument);
  if (normalized === undefined) {
    argumentError("rename 参数 subscriptionFallback trim 后不能为空");
  }
  if (hasRenameControlCharacter(normalized)) {
    argumentError("rename 参数 subscriptionFallback 不得包含控制字符");
  }
  return normalized;
}

function renameOptionsIssueMessage(issue: RenameOptionsIssue): string {
  if (issue.kind === "sequence-field-required") return "rename 参数 fields 必须包含 sequence";
  if (issue.kind === "bracket-field-unavailable") {
    return `rename 参数 brackets 引用了未启用字段: ${issue.field}`;
  }
  return "sequence=duplicates 时 fields 必须包含稳定非空字段";
}

function resolveRenameProfile(
  argumentsValue: RenameArguments,
  profiles: readonly RenameProfileIr[],
  defaultProfileId: string,
): RenameProfileIr {
  assertKnownArguments(argumentsValue);
  const profileId =
    argumentsValue["profile"] === undefined
      ? defaultProfileId
      : readArgumentString("profile", argumentsValue["profile"]);
  const profile = profiles.find(({ id }) => id === profileId);
  if (profile === undefined) argumentError(`未知 rename profile: ${profileId}`);

  const fields =
    argumentsValue["fields"] === undefined ? profile.fields : parseFields(argumentsValue["fields"]);
  const brackets =
    argumentsValue["brackets"] === undefined
      ? profile.brackets
      : parseBrackets(argumentsValue["brackets"]);

  let sequence = profile.sequence;
  if (argumentsValue["sequence"] !== undefined) {
    const value = readArgumentString("sequence", argumentsValue["sequence"]);
    if (value !== "always" && value !== "duplicates") {
      argumentError(`rename 参数 sequence 不支持: ${value}`);
    }
    sequence = value;
  }

  const separator =
    argumentsValue["separator"] === undefined
      ? profile.separator
      : parseSeparator(argumentsValue["separator"]);
  const subscriptionFallback =
    argumentsValue["subscriptionFallback"] === undefined
      ? profile.subscriptionFallback
      : parseSubscriptionFallback(argumentsValue["subscriptionFallback"]);
  const extraTraits =
    argumentsValue["extraTraits"] === undefined
      ? profile.extraTraits
      : parseList("extraTraits", argumentsValue["extraTraits"], true);
  const issue = inspectRenameOptions({ fields, brackets, sequence, subscriptionFallback })[0];
  if (issue !== undefined) {
    argumentError(renameOptionsIssueMessage(issue));
  }

  return {
    id: profile.id,
    fields,
    separator,
    brackets,
    subscriptionFallback,
    extraTraits,
    sequence,
  };
}

export { resolveRenameProfile };
export type { RenameArguments };

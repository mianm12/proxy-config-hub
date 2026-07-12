const RENAME_FIELDS = [
  "subscription",
  "flag",
  "iso",
  "protocol",
  "traits",
  "multiplier",
  "sequence",
] as const;
const RENAME_SEQUENCES = ["always", "duplicates"] as const;
const GUARANTEED_FIELDS = new Set<RenameField>(["flag", "iso", "protocol"]);

type RenameField = (typeof RENAME_FIELDS)[number];
type RenameSequence = (typeof RENAME_SEQUENCES)[number];

interface RenameOptions {
  readonly fields: readonly RenameField[];
  readonly separator: string;
  readonly brackets: readonly RenameField[];
  readonly subscriptionFallback: string | null;
  readonly extraTraits: readonly string[];
  readonly sequence: RenameSequence;
}

type RenameOptionsIssue =
  | { readonly kind: "sequence-field-required" }
  | { readonly kind: "bracket-field-unavailable"; readonly field: RenameField }
  | { readonly kind: "empty-output-possible" };

function hasRenameControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      (codePoint <= 0x1f ||
        (codePoint >= 0x7f && codePoint <= 0x9f) ||
        codePoint === 0x2028 ||
        codePoint === 0x2029)
    ) {
      return true;
    }
  }
  return false;
}

function normalizeRenameText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

function isValidRenameSeparator(value: string): boolean {
  return value.length > 0 && !hasRenameControlCharacter(value);
}

function canRenderNonEmptyRename(
  fields: readonly RenameField[],
  sequence: RenameSequence,
  subscriptionFallback: string | null,
): boolean {
  if (sequence === "always") return true;
  return (
    fields.some((field) => GUARANTEED_FIELDS.has(field)) ||
    (fields.includes("subscription") && subscriptionFallback !== null)
  );
}

function inspectRenameOptions(
  options: Pick<RenameOptions, "fields" | "brackets" | "subscriptionFallback" | "sequence">,
): readonly RenameOptionsIssue[] {
  const issues: RenameOptionsIssue[] = [];
  if (!options.fields.includes("sequence")) {
    issues.push({ kind: "sequence-field-required" });
  }

  const unavailableBracket = options.brackets.find((field) => !options.fields.includes(field));
  if (unavailableBracket !== undefined) {
    issues.push({ kind: "bracket-field-unavailable", field: unavailableBracket });
  }

  if (!canRenderNonEmptyRename(options.fields, options.sequence, options.subscriptionFallback)) {
    issues.push({ kind: "empty-output-possible" });
  }
  return issues;
}

export {
  RENAME_FIELDS,
  RENAME_SEQUENCES,
  hasRenameControlCharacter,
  inspectRenameOptions,
  isValidRenameSeparator,
  normalizeRenameText,
};
export type { RenameField, RenameOptions, RenameOptionsIssue, RenameSequence };

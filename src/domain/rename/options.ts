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

function hasRenameControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      (codePoint <= 0x1f || codePoint === 0x7f || codePoint === 0x2028 || codePoint === 0x2029)
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

export {
  RENAME_FIELDS,
  RENAME_SEQUENCES,
  canRenderNonEmptyRename,
  hasRenameControlCharacter,
  isValidRenameSeparator,
  normalizeRenameText,
};
export type { RenameField, RenameSequence };

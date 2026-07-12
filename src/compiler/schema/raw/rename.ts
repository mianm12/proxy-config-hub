import { z } from "zod";

import {
  RENAME_FIELDS,
  RENAME_SEQUENCES,
  hasRenameControlCharacter,
  inspectRenameOptions,
  isValidRenameSeparator,
  normalizeRenameText,
  type RenameOptionsIssue,
} from "../../../domain/rename/options.ts";
import { domainIdSchema } from "./common.ts";

const renameFieldSchema = z.enum(RENAME_FIELDS);
const renameSequenceSchema = z.enum(RENAME_SEQUENCES);
const renameSeparatorSchema = z.string().min(1).refine(isValidRenameSeparator, "不得包含控制字符");
const renameTextSchema = z.string().transform((value, context) => {
  const normalized = normalizeRenameText(value);
  if (normalized === undefined) {
    context.addIssue({ code: "custom", message: "trim 后不能为空" });
    return z.NEVER;
  }
  if (hasRenameControlCharacter(normalized)) {
    context.addIssue({ code: "custom", message: "不得包含控制字符" });
    return z.NEVER;
  }
  return normalized;
});

const renameProfileShape = {
  fields: z.array(renameFieldSchema).min(1),
  separator: renameSeparatorSchema,
  brackets: z.array(renameFieldSchema),
  "subscription-fallback": renameTextSchema.nullable(),
  "extra-traits": z.array(renameTextSchema),
  sequence: renameSequenceSchema,
} as const;

interface RenameProfileValue {
  readonly fields?: readonly z.infer<typeof renameFieldSchema>[] | undefined;
  readonly brackets?: readonly z.infer<typeof renameFieldSchema>[] | undefined;
  readonly "extra-traits"?: readonly string[] | undefined;
}

function findDuplicate(values: readonly string[], caseInsensitive = false): string | undefined {
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = caseInsensitive ? value.toLocaleLowerCase("en-US") : value;
    if (seen.has(normalized)) return value;
    seen.add(normalized);
  }
  return undefined;
}

function validateProfile(value: RenameProfileValue, context: z.RefinementCtx): void {
  const fields = value.fields;
  if (fields !== undefined) {
    const duplicate = findDuplicate(fields);
    if (duplicate !== undefined) {
      context.addIssue({ code: "custom", message: `fields 包含重复字段: ${duplicate}` });
    }
  }

  const brackets = value.brackets;
  if (brackets !== undefined) {
    const duplicate = findDuplicate(brackets);
    if (duplicate !== undefined) {
      context.addIssue({ code: "custom", message: `brackets 包含重复字段: ${duplicate}` });
    }
  }

  const extraTraits = value["extra-traits"];
  if (extraTraits !== undefined) {
    const duplicate = findDuplicate(extraTraits, true);
    if (duplicate !== undefined) {
      context.addIssue({ code: "custom", message: `extra-traits 包含重复特征: ${duplicate}` });
    }
  }
}

function renameOptionsIssueMessage(issue: RenameOptionsIssue): string {
  if (issue.kind === "sequence-field-required") return "fields 必须包含 sequence";
  if (issue.kind === "bracket-field-unavailable") {
    return `brackets 引用了未启用字段: ${issue.field}`;
  }
  return "sequence=duplicates 时 fields 必须包含稳定非空字段";
}

const renameDefaultsSchema = z
  .object(renameProfileShape)
  .strict()
  .superRefine((value, context) => {
    validateProfile(value, context);
  });

const renameProfileOverrideSchema = z
  .object({
    fields: renameProfileShape.fields.optional(),
    separator: renameProfileShape.separator.optional(),
    brackets: renameProfileShape.brackets.optional(),
    "subscription-fallback": renameProfileShape["subscription-fallback"].optional(),
    "extra-traits": renameProfileShape["extra-traits"].optional(),
    sequence: renameProfileShape.sequence.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    validateProfile(value, context);
  });

const renameProfilesSchema = z
  .object({
    "default-profile": domainIdSchema,
    defaults: renameDefaultsSchema,
    profiles: z.record(domainIdSchema, renameProfileOverrideSchema),
  })
  .strict()
  .superRefine((value, context) => {
    if (!Object.hasOwn(value.profiles, value["default-profile"])) {
      context.addIssue({
        code: "custom",
        path: ["default-profile"],
        message: `default-profile 未定义: ${value["default-profile"]}`,
      });
    }

    for (const [id, profile] of Object.entries(value.profiles)) {
      const fields = profile.fields ?? value.defaults.fields;
      const brackets = profile.brackets ?? value.defaults.brackets;
      const sequence = profile.sequence ?? value.defaults.sequence;
      const subscriptionFallback =
        profile["subscription-fallback"] === undefined
          ? value.defaults["subscription-fallback"]
          : profile["subscription-fallback"];
      for (const issue of inspectRenameOptions({
        fields,
        brackets,
        sequence,
        subscriptionFallback,
      })) {
        context.addIssue({
          code: "custom",
          path: [
            "profiles",
            id,
            issue.kind === "bracket-field-unavailable" ? "brackets" : "fields",
          ],
          message: renameOptionsIssueMessage(issue),
        });
      }
    }
  });

type RawRenameProfiles = z.infer<typeof renameProfilesSchema>;

export { renameFieldSchema, renameProfilesSchema, renameSequenceSchema };
export type { RawRenameProfiles };

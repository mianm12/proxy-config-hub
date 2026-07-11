import { z } from "zod";

import { domainIdSchema, nonEmptyStringSchema } from "./common.js";

const renameProfileSchema = z
  .object({
    prefix: nonEmptyStringSchema,
    "prefix-position": z.enum(["first", "last"]),
    separator: z.string(),
    "add-flag": z.boolean(),
    "preserve-multiplier": z.boolean(),
    "collapse-single": z.boolean(),
    "preserve-tags": z.array(nonEmptyStringSchema),
  })
  .strict();

const renameProfilesSchema = z
  .object({ profiles: z.record(domainIdSchema, renameProfileSchema) })
  .strict();

type RawRenameProfiles = z.infer<typeof renameProfilesSchema>;

export { renameProfilesSchema };
export type { RawRenameProfiles };

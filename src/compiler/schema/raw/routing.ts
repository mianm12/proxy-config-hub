import { z } from "zod";

import {
  domainIdSchema,
  groupMemberSchema,
  groupTypeSchema,
  mihomoOptionsSchema,
  nonEmptyStringSchema,
  providerIdSchema,
  providerReferenceSchema,
  providerSchema,
} from "./common.ts";

const groupTemplateSchema = z
  .object({
    type: groupTypeSchema,
    members: z.array(groupMemberSchema).min(1),
    mihomo: mihomoOptionsSchema.optional(),
  })
  .strict();

const groupTemplatesSchema = z
  .object({ templates: z.record(domainIdSchema, groupTemplateSchema) })
  .strict();

const providerSourceSchema = z
  .object({
    "id-template": nonEmptyStringSchema,
    "url-template": nonEmptyStringSchema,
    "path-template": nonEmptyStringSchema,
    provider: providerSchema
      .omit({ url: true, path: true })
      .extend({ type: z.literal("http") })
      .strict(),
    mihomo: mihomoOptionsSchema.optional(),
  })
  .strict();

const providerSourcesSchema = z
  .object({ sources: z.record(domainIdSchema, providerSourceSchema) })
  .strict();

const templateGroupSchema = z
  .object({
    id: domainIdSchema,
    name: nonEmptyStringSchema,
    template: domainIdSchema,
    hidden: z.boolean().optional(),
    mihomo: mihomoOptionsSchema.optional(),
  })
  .strict();

const inlineGroupSchema = z
  .object({
    id: domainIdSchema,
    name: nonEmptyStringSchema,
    type: groupTypeSchema,
    members: z.array(groupMemberSchema).min(1),
    hidden: z.boolean().optional(),
    mihomo: mihomoOptionsSchema.optional(),
  })
  .strict();

const groupSchema = z.union([templateGroupSchema, inlineGroupSchema]);

const ruleSetRuleSchema = z
  .object({
    type: z.literal("RULE-SET"),
    provider: providerIdSchema,
    target: z.union([domainIdSchema, z.string().regex(/^[A-Z][A-Z-]*$/)]).optional(),
    "no-resolve": z.boolean().optional(),
  })
  .strict();

const rawRuleSchema = z
  .object({
    raw: nonEmptyStringSchema,
    target: z.union([domainIdSchema, z.string().regex(/^[A-Z][A-Z-]*$/)]).optional(),
  })
  .strict();

const ruleBlockSchema = z
  .object({
    id: domainIdSchema,
    target: z.union([domainIdSchema, z.string().regex(/^[A-Z][A-Z-]*$/)]),
    providers: z.array(providerReferenceSchema).optional(),
    rules: z.array(z.union([ruleSetRuleSchema, rawRuleSchema])).optional(),
  })
  .strict()
  .refine((block) => (block.providers?.length ?? 0) + (block.rules?.length ?? 0) > 0, {
    message: "rule block 至少需要 providers 或 rules",
  });

const orderingConstraintSchema = z
  .object({
    before: providerIdSchema,
    after: providerIdSchema,
    reason: nonEmptyStringSchema,
  })
  .strict();

const routingModuleSchema = z
  .object({
    id: domainIdSchema,
    groups: z.array(groupSchema),
    "rule-blocks": z.array(ruleBlockSchema),
    constraints: z.array(orderingConstraintSchema).optional(),
  })
  .strict();

type RawGroupTemplates = z.infer<typeof groupTemplatesSchema>;
type RawProviderSources = z.infer<typeof providerSourcesSchema>;
type RawRoutingModule = z.infer<typeof routingModuleSchema>;

export { groupTemplatesSchema, providerSourcesSchema, routingModuleSchema };
export type { RawGroupTemplates, RawProviderSources, RawRoutingModule };

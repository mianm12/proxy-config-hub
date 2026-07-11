import { z } from "zod";

const domainIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9_]*$/, "必须使用 snake_case 稳定 ID");

const providerIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9_!+.-]*$/, "provider ID 包含非法字符");

const providerSourceNameSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9_!+@.-]*$/, "provider source name 包含非法字符");

const relativeConfigPathSchema = z.string().min(1);
const nonEmptyStringSchema = z.string().min(1);
const mihomoOptionsSchema = z.record(z.string(), z.unknown());
const groupTypeSchema = z.enum(["select", "url-test", "fallback", "load-balance"]);
const generatedGroupKindSchema = z.enum(["chain_groups", "transit_groups", "region_groups"]);
const builtinTargetSchema = z.enum([
  "COMPATIBLE",
  "DIRECT",
  "DNS",
  "PASS",
  "REJECT",
  "REJECT-DROP",
]);

const groupMemberSchema = z.union([
  z.object({ group: domainIdSchema }).strict(),
  z.object({ pool: z.literal("all_nodes") }).strict(),
  z.object({ generated: generatedGroupKindSchema }).strict(),
  z.object({ builtin: builtinTargetSchema }).strict(),
  z.object({ node: nonEmptyStringSchema }).strict(),
]);

const providerSchema = z
  .object({
    type: z.enum(["http", "file", "inline"]),
    behavior: z.enum(["domain", "ipcidr", "classical"]),
    format: z.enum(["yaml", "text", "mrs"]).optional(),
    url: z.url().optional(),
    path: nonEmptyStringSchema.optional(),
    interval: z.number().int().positive().optional(),
  })
  .strict();

const sourceProviderReferenceSchema = z
  .object({
    source: domainIdSchema,
    name: providerSourceNameSchema,
    id: providerIdSchema.optional(),
    "no-resolve": z.boolean().optional(),
  })
  .strict();

const customProviderReferenceSchema = z
  .object({
    id: providerIdSchema,
    provider: providerSchema,
    mihomo: mihomoOptionsSchema.optional(),
    "no-resolve": z.boolean().optional(),
  })
  .strict();

const providerReferenceSchema = z.union([
  sourceProviderReferenceSchema,
  customProviderReferenceSchema,
]);

export {
  builtinTargetSchema,
  customProviderReferenceSchema,
  domainIdSchema,
  generatedGroupKindSchema,
  groupMemberSchema,
  groupTypeSchema,
  mihomoOptionsSchema,
  nonEmptyStringSchema,
  providerIdSchema,
  providerSourceNameSchema,
  providerReferenceSchema,
  providerSchema,
  relativeConfigPathSchema,
  sourceProviderReferenceSchema,
};

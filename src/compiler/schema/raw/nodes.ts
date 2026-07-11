import { z } from "zod";

import { domainIdSchema, nonEmptyStringSchema } from "./common.ts";

const regionIdSchema = z
  .string()
  .min(2)
  .regex(/^[A-Z][A-Z0-9_]*$/, "地区 ID 必须使用大写稳定代码");

const regionSchema = z
  .object({
    id: regionIdSchema,
    name: nonEmptyStringSchema,
    emoji: nonEmptyStringSchema,
    codes: z.array(nonEmptyStringSchema).min(1),
    names: z
      .object({
        zh: z.array(nonEmptyStringSchema).min(1),
        en: z.array(nonEmptyStringSchema).min(1),
      })
      .strict(),
    aliases: z.array(nonEmptyStringSchema),
    cities: z.array(nonEmptyStringSchema),
  })
  .strict();

const nodeCatalogSchema = z.object({ regions: z.array(regionSchema).min(1) }).strict();

const routingRegionSchema = z
  .object({
    id: z.union([regionIdSchema, z.literal("OTHER")]),
    "group-name": nonEmptyStringSchema,
    type: z.literal("select"),
  })
  .strict();

const routingRegionsSchema = z.object({ regions: z.array(routingRegionSchema).min(1) }).strict();

const keywordSelectorSchema = z
  .object({
    "any-name": z.array(nonEmptyStringSchema).min(1).optional(),
    "all-names": z.array(nonEmptyStringSchema).min(1).optional(),
  })
  .strict()
  .refine((selector) => selector["any-name"] !== undefined || selector["all-names"] !== undefined, {
    message: "selector 至少需要 any-name 或 all-names",
  });

const regexSelectorSchema = z
  .object({
    regex: nonEmptyStringSchema,
    flags: z
      .string()
      .regex(/^[dgimsuvy]*$/, "包含非法正则 flags")
      .optional(),
  })
  .strict();

const nodeSelectorSchema = z.union([keywordSelectorSchema, regexSelectorSchema]);

const chainEndpointSchema = z
  .object({
    id: domainIdSchema,
    "group-name": nonEmptyStringSchema,
    type: z.literal("select"),
    selector: nodeSelectorSchema,
  })
  .strict();

const chainSchema = z
  .object({
    id: domainIdSchema,
    transit: chainEndpointSchema.extend({ "include-direct": z.boolean() }).strict(),
    landing: chainEndpointSchema,
  })
  .strict();

const chainsSchema = z.object({ chains: z.array(chainSchema) }).strict();

type RawChains = z.infer<typeof chainsSchema>;
type RawNodeCatalog = z.infer<typeof nodeCatalogSchema>;
type RawRoutingRegions = z.infer<typeof routingRegionsSchema>;

export { chainsSchema, nodeCatalogSchema, nodeSelectorSchema, routingRegionsSchema };
export type { RawChains, RawNodeCatalog, RawRoutingRegions };

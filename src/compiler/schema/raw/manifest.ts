import { z } from "zod";

import { domainIdSchema, generatedGroupKindSchema, relativeConfigPathSchema } from "./common.ts";

const runtimeApplySchema = z.enum(["overlay", "replace", "if-absent"]);

const runtimeSourceItemSchema = z
  .object({
    source: relativeConfigPathSchema,
    target: z.string().min(1),
    apply: runtimeApplySchema,
  })
  .strict();

const runtimeValueItemSchema = z
  .object({
    value: z.unknown(),
    target: z.string().min(1),
    apply: runtimeApplySchema,
  })
  .strict();

const groupLayoutItemSchema = z.union([
  z.object({ group: domainIdSchema }).strict(),
  z.object({ generated: generatedGroupKindSchema }).strict(),
]);

const modulePipelineItemSchema = z
  .object({
    module: domainIdSchema,
    block: domainIdSchema.optional(),
  })
  .strict();

const fallbackPipelineItemSchema = z.object({ fallback: domainIdSchema }).strict();

const manifestSchema = z
  .object({
    "schema-version": z.literal(2),
    runtime: z.array(z.union([runtimeSourceItemSchema, runtimeValueItemSchema])),
    nodes: z
      .object({
        catalog: relativeConfigPathSchema,
        "routing-regions": relativeConfigPathSchema,
        chains: relativeConfigPathSchema,
      })
      .strict(),
    routing: z
      .object({
        "group-templates": relativeConfigPathSchema,
        "provider-sources": relativeConfigPathSchema,
        modules: z.array(relativeConfigPathSchema).min(1),
        "group-layout": z.array(groupLayoutItemSchema).min(1),
        "rule-pipeline": z
          .array(z.union([modulePipelineItemSchema, fallbackPipelineItemSchema]))
          .min(1),
      })
      .strict(),
    rename: z.object({ profiles: relativeConfigPathSchema }).strict(),
    deployment: z
      .object({
        channel: z.literal("v2"),
        "public-base-url": z
          .url()
          .refine((url) => {
            const parsed = new URL(url);
            return (
              (parsed.protocol === "https:" || parsed.protocol === "http:") &&
              parsed.username === "" &&
              parsed.password === "" &&
              parsed.search === "" &&
              parsed.hash === ""
            );
          }, "必须是无凭据、query 和 fragment 的 HTTP(S) 基址")
          .nullable(),
      })
      .strict(),
  })
  .strict();

type RawManifest = z.infer<typeof manifestSchema>;

export { manifestSchema };
export type { RawManifest };

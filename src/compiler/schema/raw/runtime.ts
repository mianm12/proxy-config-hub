import { z } from "zod";

const runtimeConfigSchema = z.record(z.string(), z.unknown());

type RawRuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export { runtimeConfigSchema };
export type { RawRuntimeConfig };

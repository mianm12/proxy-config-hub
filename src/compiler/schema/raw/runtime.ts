import { z } from "zod";

const runtimeConfigSchema = z.record(z.string(), z.unknown());
const dnsServersSchema = z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]);
const dnsPolicySchema = z.record(z.string(), dnsServersSchema);

type RawRuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export { dnsPolicySchema, dnsServersSchema, runtimeConfigSchema };
export type { RawRuntimeConfig };

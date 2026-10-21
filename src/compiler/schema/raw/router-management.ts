import { z } from "zod";

const managementDomainSchema = z
  .string()
  .max(253)
  .regex(
    /^(?:\+\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/,
    "只允许小写精确域名或 +.域名，不允许 URL、端口或末尾点",
  );

const routerManagementSchema = z
  .object({
    brands: z
      .array(
        z
          .object({
            brand: z.string().trim().min(1),
            domains: z.array(managementDomainSchema).min(1),
            dns: z.array(z.ipv4()).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

type RawRouterManagement = z.infer<typeof routerManagementSchema>;

export { routerManagementSchema };
export type { RawRouterManagement };

import { z } from "zod";

export const settlementOrderSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  total: z.number(),
  version: z.number(),
  status: z.union([
    z.literal("draft"),
    z.literal("confirmed"),
    z.literal("shipped"),
    z.literal("completed"),
    z.literal("cancelled"),
  ]),
  createdAt: z.string(),
});
export const SettlementOrder = settlementOrderSchema.brand<"SettlementOrder">().readonly();

export type SettlementOrder = z.infer<typeof SettlementOrder>;

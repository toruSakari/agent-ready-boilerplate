import { z } from "zod";
import { stockAdjustmentSchema } from "#api/domain/inventory/policies/stock-adjustment.ts";

const adjustmentMetadata = {
  operationId: z.string(),
  sku: z.string(),
  actorId: z.string(),
  tenantId: z.string(),
};

export const stockAdjustmentInputSchema = z.discriminatedUnion("operation", [
  stockAdjustmentSchema.options[0].extend(adjustmentMetadata),
  stockAdjustmentSchema.options[1].extend(adjustmentMetadata),
]);

export const StockAdjustmentInput = stockAdjustmentInputSchema
  .brand<"StockAdjustmentInput">()
  .readonly();

export type StockAdjustmentInput = z.infer<typeof StockAdjustmentInput>;

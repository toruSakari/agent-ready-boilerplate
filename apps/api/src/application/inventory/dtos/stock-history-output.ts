import { z } from "zod";
import { stockAdjustmentSchema } from "#api/domain/inventory/policies/stock-adjustment.ts";

export const stockHistoryEntryDtoSchema = z.object({
  id: z.string(),
  operation: z.union([
    z.literal("initial"),
    stockAdjustmentSchema.options[0].shape.operation,
    stockAdjustmentSchema.options[1].shape.operation,
  ]),
  reason: z.union([
    z.literal("initial"),
    stockAdjustmentSchema.options[0].shape.reason,
    stockAdjustmentSchema.options[1].shape.reason,
  ]),
  quantity: z.number(),
  beforeStock: z.number(),
  afterStock: z.number(),
  createdAt: z.string(),
  actorName: z.union([z.string(), z.null()]),
});
export const StockHistoryEntryDto = stockHistoryEntryDtoSchema
  .brand<"StockHistoryEntryDto">()
  .readonly();

export type StockHistoryEntryDto = z.infer<typeof StockHistoryEntryDto>;

import { z } from "zod";
import { StockHistoryEntryDto } from "#api/application/inventory/dtos/stock-history-output.ts";

export const inventoryOverviewHistoryOutputDtoSchema = z.object({
  items: z.array(StockHistoryEntryDto),
});

export const InventoryOverviewHistoryOutputDto = inventoryOverviewHistoryOutputDtoSchema
  .brand<"InventoryOverviewHistoryOutputDto">()
  .readonly();

export type InventoryOverviewHistoryOutputDto = z.infer<typeof InventoryOverviewHistoryOutputDto>;

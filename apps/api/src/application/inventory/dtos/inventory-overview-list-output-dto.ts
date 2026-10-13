import { z } from "zod";
import { ManagedStockDto } from "#api/application/inventory/dtos/managed-stock-output.ts";

export const inventoryOverviewListOutputDtoSchema = z.object({
  items: z.array(
    ManagedStockDto.and(
      z.object({ id: z.string(), sku: z.string(), name: z.string(), createdAt: z.string() }),
    ),
  ),
});

export const InventoryOverviewListOutputDto = inventoryOverviewListOutputDtoSchema
  .brand<"InventoryOverviewListOutputDto">()
  .readonly();

export type InventoryOverviewListOutputDto = z.infer<typeof InventoryOverviewListOutputDto>;

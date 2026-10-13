import type { z } from "zod";
import { managedStockDtoSchema } from "#api/application/inventory/dtos/managed-stock-output.ts";

export const manageStockAdjustOutputDtoSchema = managedStockDtoSchema;

export const ManageStockAdjustOutputDto = manageStockAdjustOutputDtoSchema
  .brand<"ManageStockAdjustOutputDto">()
  .readonly();

export type ManageStockAdjustOutputDto = z.infer<typeof ManageStockAdjustOutputDto>;

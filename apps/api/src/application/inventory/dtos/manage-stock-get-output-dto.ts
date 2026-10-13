import type { z } from "zod";
import { managedStockDtoSchema } from "#api/application/inventory/dtos/managed-stock-output.ts";

export const manageStockGetOutputDtoSchema = managedStockDtoSchema;

export const ManageStockGetOutputDto = manageStockGetOutputDtoSchema
  .brand<"ManageStockGetOutputDto">()
  .readonly();

export type ManageStockGetOutputDto = z.infer<typeof ManageStockGetOutputDto>;

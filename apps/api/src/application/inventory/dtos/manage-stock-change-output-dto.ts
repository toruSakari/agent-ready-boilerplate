import type { z } from "zod";
import { managedStockDtoSchema } from "#api/application/inventory/dtos/managed-stock-output.ts";

export const manageStockChangeOutputDtoSchema = managedStockDtoSchema;

export const ManageStockChangeOutputDto = manageStockChangeOutputDtoSchema
  .brand<"ManageStockChangeOutputDto">()
  .readonly();

export type ManageStockChangeOutputDto = z.infer<typeof ManageStockChangeOutputDto>;

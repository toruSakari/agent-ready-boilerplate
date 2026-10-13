import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";
import { stockAdjustmentSchema } from "#api/domain/inventory/policies/stock-adjustment.ts";

export const manageStockAdjustInputDtoSchema = z.object({
  actor: authorizedActorSchema,
  input: z.object({ id: z.string(), operationId: z.string(), adjustment: stockAdjustmentSchema }),
});

export const ManageStockAdjustInputDto = manageStockAdjustInputDtoSchema
  .brand<"ManageStockAdjustInputDto">()
  .readonly();

export type ManageStockAdjustInputDto = z.infer<typeof ManageStockAdjustInputDto>;

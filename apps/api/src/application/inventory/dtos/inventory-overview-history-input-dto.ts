import { z } from "zod";
import { authorizedActorSchema, pageRequestSchema } from "#api/application/shared/dto-schemas.ts";

export const inventoryOverviewHistoryInputDtoSchema = z.object({
  actor: authorizedActorSchema,
  id: z.string(),
  request: pageRequestSchema.partial().optional(),
});

export const InventoryOverviewHistoryInputDto = inventoryOverviewHistoryInputDtoSchema
  .brand<"InventoryOverviewHistoryInputDto">()
  .readonly();

export type InventoryOverviewHistoryInputDto = z.infer<typeof InventoryOverviewHistoryInputDto>;

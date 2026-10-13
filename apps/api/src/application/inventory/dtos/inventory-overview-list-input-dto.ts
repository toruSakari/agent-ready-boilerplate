import { z } from "zod";
import { authorizedActorSchema, pageRequestSchema } from "#api/application/shared/dto-schemas.ts";
import { inventoryFiltersSchema } from "#api/domain/shared/list-filters.ts";

export const inventoryOverviewListInputDtoSchema = z.object({
  actor: authorizedActorSchema,
  request: pageRequestSchema.partial().optional(),
  filters: inventoryFiltersSchema.optional(),
});

export const InventoryOverviewListInputDto = inventoryOverviewListInputDtoSchema
  .brand<"InventoryOverviewListInputDto">()
  .readonly();

export type InventoryOverviewListInputDto = z.infer<typeof InventoryOverviewListInputDto>;

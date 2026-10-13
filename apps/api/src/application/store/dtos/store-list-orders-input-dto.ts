import { z } from "zod";
import { pageRequestSchema, authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";
import { orderFiltersSchema } from "#api/domain/shared/list-filters.ts";

export const storeListOrdersInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  page: pageRequestSchema,
  filters: orderFiltersSchema.optional(),
});

export const StoreListOrdersInputDto = storeListOrdersInputDtoSchema
  .brand<"StoreListOrdersInputDto">()
  .readonly();

export type StoreListOrdersInputDto = z.infer<typeof StoreListOrdersInputDto>;

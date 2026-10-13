import { z } from "zod";
import { authorizedActorSchema, pageRequestSchema } from "#api/application/shared/dto-schemas.ts";
import { listFiltersSchema } from "#api/domain/shared/list-filters.ts";

export const productListInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  page: pageRequestSchema.optional(),
  filters: listFiltersSchema.optional(),
});

export const ProductListInputDto = productListInputDtoSchema
  .brand<"ProductListInputDto">()
  .readonly();

export type ProductListInputDto = z.infer<typeof ProductListInputDto>;

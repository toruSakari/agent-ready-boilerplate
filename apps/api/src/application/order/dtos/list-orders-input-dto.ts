import { z } from "zod";
import { authorizedActorSchema, pageRequestSchema } from "#api/application/shared/dto-schemas.ts";
import { orderFiltersSchema } from "#api/domain/shared/list-filters.ts";

export const listOrdersInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  page: pageRequestSchema.optional(),
  filters: orderFiltersSchema.optional(),
});

export const ListOrdersInputDto = listOrdersInputDtoSchema.brand<"ListOrdersInputDto">().readonly();

export type ListOrdersInputDto = z.infer<typeof ListOrdersInputDto>;

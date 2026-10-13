import { z } from "zod";
import { pageRequestSchema } from "#api/application/shared/dto-schemas.ts";
import { storeFiltersSchema } from "#api/domain/shared/list-filters.ts";

export const storeListInputDtoSchema = z.object({
  page: pageRequestSchema,
  search: z.union([z.string(), z.undefined()]).optional(),
  filters: storeFiltersSchema.optional(),
});

export const StoreListInputDto = storeListInputDtoSchema.brand<"StoreListInputDto">().readonly();

export type StoreListInputDto = z.infer<typeof StoreListInputDto>;

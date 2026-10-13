import type { z } from "zod";
import { storedImageSchema } from "#api/application/product/dtos/product-value-schemas.ts";

export const storeGetImageOutputDtoSchema = storedImageSchema;

export const StoreGetImageOutputDto = storeGetImageOutputDtoSchema
  .brand<"StoreGetImageOutputDto">()
  .readonly();

export type StoreGetImageOutputDto = z.infer<typeof StoreGetImageOutputDto>;

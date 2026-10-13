import type { z } from "zod";
import { storedImageSchema } from "#api/application/product/dtos/product-value-schemas.ts";

export const productGetImageOutputDtoSchema = storedImageSchema;

export const ProductGetImageOutputDto = productGetImageOutputDtoSchema
  .brand<"ProductGetImageOutputDto">()
  .readonly();

export type ProductGetImageOutputDto = z.infer<typeof ProductGetImageOutputDto>;

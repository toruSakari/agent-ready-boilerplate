import type { z } from "zod";
import { productImageSchema } from "#api/application/product/dtos/product-value-schemas.ts";

export const productAddImageOutputDtoSchema = productImageSchema;

export const ProductAddImageOutputDto = productAddImageOutputDtoSchema
  .brand<"ProductAddImageOutputDto">()
  .readonly();

export type ProductAddImageOutputDto = z.infer<typeof ProductAddImageOutputDto>;

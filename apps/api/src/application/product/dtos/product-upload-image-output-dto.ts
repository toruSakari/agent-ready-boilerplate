import type { z } from "zod";
import { productImageSchema } from "#api/application/product/dtos/product-value-schemas.ts";

export const productUploadImageOutputDtoSchema = productImageSchema;

export const ProductUploadImageOutputDto = productUploadImageOutputDtoSchema
  .brand<"ProductUploadImageOutputDto">()
  .readonly();

export type ProductUploadImageOutputDto = z.infer<typeof ProductUploadImageOutputDto>;

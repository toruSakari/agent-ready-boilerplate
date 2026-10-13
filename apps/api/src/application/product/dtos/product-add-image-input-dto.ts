import type { z } from "zod";
import { productUploadImageInputDtoSchema } from "#api/application/product/schemas/product-image-input-schemas.ts";

export const productAddImageInputDtoSchema = productUploadImageInputDtoSchema;

export const ProductAddImageInputDto = productAddImageInputDtoSchema
  .brand<"ProductAddImageInputDto">()
  .readonly();

export type ProductAddImageInputDto = z.infer<typeof ProductAddImageInputDto>;

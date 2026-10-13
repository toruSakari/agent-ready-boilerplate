import type { z } from "zod";
import { productListItemDtoSchema } from "#api/application/product/dtos/product-output.ts";

export const productUpdateOutputDtoSchema = productListItemDtoSchema;

export const ProductUpdateOutputDto = productUpdateOutputDtoSchema
  .brand<"ProductUpdateOutputDto">()
  .readonly();

export type ProductUpdateOutputDto = z.infer<typeof ProductUpdateOutputDto>;

import type { z } from "zod";
import { productListItemDtoSchema } from "#api/application/product/dtos/product-output.ts";

export const productGetOutputDtoSchema = productListItemDtoSchema;

export const ProductGetOutputDto = productGetOutputDtoSchema
  .brand<"ProductGetOutputDto">()
  .readonly();

export type ProductGetOutputDto = z.infer<typeof ProductGetOutputDto>;

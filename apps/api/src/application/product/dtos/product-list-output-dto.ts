import { z } from "zod";
import { ProductListItemDto } from "#api/application/product/dtos/product-output.ts";

export const productListOutputDtoSchema = z.object({ items: z.array(ProductListItemDto) });

export const ProductListOutputDto = productListOutputDtoSchema
  .brand<"ProductListOutputDto">()
  .readonly();

export type ProductListOutputDto = z.infer<typeof ProductListOutputDto>;

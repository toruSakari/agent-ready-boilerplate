import type { z } from "zod";
import { productListItemDtoSchema } from "#api/application/product/dtos/product-output.ts";

export const createProductOutputDtoSchema = productListItemDtoSchema;

export const CreateProductOutputDto = createProductOutputDtoSchema
  .brand<"CreateProductOutputDto">()
  .readonly();

export type CreateProductOutputDto = z.infer<typeof CreateProductOutputDto>;

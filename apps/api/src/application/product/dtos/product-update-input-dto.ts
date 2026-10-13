import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";
import { UpdateProductInput } from "#api/application/product/dtos/update-product-input.ts";

export const productUpdateInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  input: UpdateProductInput,
});

export const ProductUpdateInputDto = productUpdateInputDtoSchema
  .brand<"ProductUpdateInputDto">()
  .readonly();

export type ProductUpdateInputDto = z.infer<typeof ProductUpdateInputDto>;

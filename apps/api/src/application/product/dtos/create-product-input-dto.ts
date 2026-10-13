import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";
import { CreateProductInput } from "#api/application/product/dtos/create-product-input.ts";

export const createProductInputDtoSchema = z.object({
  actor: authorizedActorSchema,
  input: CreateProductInput,
});

export const CreateProductInputDto = createProductInputDtoSchema
  .brand<"CreateProductInputDto">()
  .readonly();

export type CreateProductInputDto = z.infer<typeof CreateProductInputDto>;

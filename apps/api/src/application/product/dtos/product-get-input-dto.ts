import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const productGetInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  id: z.string(),
});

export const ProductGetInputDto = productGetInputDtoSchema.brand<"ProductGetInputDto">().readonly();

export type ProductGetInputDto = z.infer<typeof ProductGetInputDto>;

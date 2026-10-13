import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const productGetImageInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  id: z.string(),
  imageId: z.union([z.string(), z.undefined()]).optional(),
});

export const ProductGetImageInputDto = productGetImageInputDtoSchema
  .brand<"ProductGetImageInputDto">()
  .readonly();

export type ProductGetImageInputDto = z.infer<typeof ProductGetImageInputDto>;

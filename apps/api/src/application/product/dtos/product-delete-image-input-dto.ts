import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const productDeleteImageInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  id: z.string(),
  imageId: z.union([z.string(), z.undefined()]).optional(),
});

export const ProductDeleteImageInputDto = productDeleteImageInputDtoSchema
  .brand<"ProductDeleteImageInputDto">()
  .readonly();

export type ProductDeleteImageInputDto = z.infer<typeof ProductDeleteImageInputDto>;

import { z } from "zod";
import { authorizedActorSchema, arrayBufferSchema } from "#api/application/shared/dto-schemas.ts";

export const productUploadImageInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  id: z.string(),
  bytes: arrayBufferSchema,
  contentType: z.string(),
});

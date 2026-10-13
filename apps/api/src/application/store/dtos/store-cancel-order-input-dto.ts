import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const storeCancelOrderInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  id: z.string(),
  version: z.number(),
});

export const StoreCancelOrderInputDto = storeCancelOrderInputDtoSchema
  .brand<"StoreCancelOrderInputDto">()
  .readonly();

export type StoreCancelOrderInputDto = z.infer<typeof StoreCancelOrderInputDto>;

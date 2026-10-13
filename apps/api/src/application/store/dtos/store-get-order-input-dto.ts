import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const storeGetOrderInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  id: z.string(),
});

export const StoreGetOrderInputDto = storeGetOrderInputDtoSchema
  .brand<"StoreGetOrderInputDto">()
  .readonly();

export type StoreGetOrderInputDto = z.infer<typeof StoreGetOrderInputDto>;

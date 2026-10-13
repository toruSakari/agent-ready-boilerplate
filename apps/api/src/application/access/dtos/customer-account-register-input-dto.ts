import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const customerAccountRegisterInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  input: z.object({ name: z.string() }),
});

export const CustomerAccountRegisterInputDto = customerAccountRegisterInputDtoSchema
  .brand<"CustomerAccountRegisterInputDto">()
  .readonly();

export type CustomerAccountRegisterInputDto = z.infer<typeof CustomerAccountRegisterInputDto>;

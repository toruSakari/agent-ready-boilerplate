import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const customerAccountRegistrationInputDtoSchema = z.object({
  identity: authorizedActorSchema,
});

export const CustomerAccountRegistrationInputDto = customerAccountRegistrationInputDtoSchema
  .brand<"CustomerAccountRegistrationInputDto">()
  .readonly();

export type CustomerAccountRegistrationInputDto = z.infer<
  typeof CustomerAccountRegistrationInputDto
>;

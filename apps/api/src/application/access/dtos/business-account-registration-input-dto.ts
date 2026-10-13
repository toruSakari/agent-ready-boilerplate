import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const businessAccountRegistrationInputDtoSchema = z.object({
  identity: authorizedActorSchema,
});

export const BusinessAccountRegistrationInputDto = businessAccountRegistrationInputDtoSchema
  .brand<"BusinessAccountRegistrationInputDto">()
  .readonly();

export type BusinessAccountRegistrationInputDto = z.infer<
  typeof BusinessAccountRegistrationInputDto
>;

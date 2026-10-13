import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const operatorAccountRegistrationInputDtoSchema = z.object({
  identity: authorizedActorSchema,
});

export const OperatorAccountRegistrationInputDto = operatorAccountRegistrationInputDtoSchema
  .brand<"OperatorAccountRegistrationInputDto">()
  .readonly();

export type OperatorAccountRegistrationInputDto = z.infer<
  typeof OperatorAccountRegistrationInputDto
>;

import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const operatorAccountRegisterFromInvitationInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  input: z.object({ token: z.string(), name: z.string() }),
});

export const OperatorAccountRegisterFromInvitationInputDto =
  operatorAccountRegisterFromInvitationInputDtoSchema
    .brand<"OperatorAccountRegisterFromInvitationInputDto">()
    .readonly();

export type OperatorAccountRegisterFromInvitationInputDto = z.infer<
  typeof OperatorAccountRegisterFromInvitationInputDto
>;

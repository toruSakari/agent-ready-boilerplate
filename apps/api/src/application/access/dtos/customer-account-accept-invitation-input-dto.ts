import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const customerAccountAcceptInvitationInputDtoSchema = z.object({
  _identity: authorizedActorSchema,
  _input: z.object({ token: z.string(), name: z.string() }),
});

export const CustomerAccountAcceptInvitationInputDto = customerAccountAcceptInvitationInputDtoSchema
  .brand<"CustomerAccountAcceptInvitationInputDto">()
  .readonly();

export type CustomerAccountAcceptInvitationInputDto = z.infer<
  typeof CustomerAccountAcceptInvitationInputDto
>;

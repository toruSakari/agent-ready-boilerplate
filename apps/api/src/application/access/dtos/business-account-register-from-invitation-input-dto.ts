import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const businessAccountRegisterFromInvitationInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  input: z.object({ token: z.string(), name: z.string() }),
});

export const BusinessAccountRegisterFromInvitationInputDto =
  businessAccountRegisterFromInvitationInputDtoSchema
    .brand<"BusinessAccountRegisterFromInvitationInputDto">()
    .readonly();

export type BusinessAccountRegisterFromInvitationInputDto = z.infer<
  typeof BusinessAccountRegisterFromInvitationInputDto
>;

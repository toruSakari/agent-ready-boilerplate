import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessAcceptInvitationInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  input: z.object({ token: z.string(), name: z.string() }),
});

export const AccessAcceptInvitationInputDto = accessAcceptInvitationInputDtoSchema
  .brand<"AccessAcceptInvitationInputDto">()
  .readonly();

export type AccessAcceptInvitationInputDto = z.infer<typeof AccessAcceptInvitationInputDto>;

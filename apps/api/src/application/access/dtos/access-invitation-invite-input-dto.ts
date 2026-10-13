import { z } from "zod";
import {
  authorizedActorSchema,
  accountCategorySchema,
} from "#api/application/shared/dto-schemas.ts";

export const accessInvitationInviteInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  input: z.object({
    scope: z.string(),
    email: z.string(),
    roleId: z.string(),
    actorKind: accountCategorySchema,
  }),
});

export const AccessInvitationInviteInputDto = accessInvitationInviteInputDtoSchema
  .brand<"AccessInvitationInviteInputDto">()
  .readonly();

export type AccessInvitationInviteInputDto = z.infer<typeof AccessInvitationInviteInputDto>;

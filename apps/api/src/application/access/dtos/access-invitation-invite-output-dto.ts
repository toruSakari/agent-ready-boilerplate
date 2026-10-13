import { z } from "zod";
import { accountCategorySchema } from "#api/application/shared/dto-schemas.ts";

export const accessInvitationInviteOutputDtoSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  scope: z.string(),
  actorKind: accountCategorySchema,
});

export const AccessInvitationInviteOutputDto = accessInvitationInviteOutputDtoSchema
  .brand<"AccessInvitationInviteOutputDto">()
  .readonly();

export type AccessInvitationInviteOutputDto = z.infer<typeof AccessInvitationInviteOutputDto>;

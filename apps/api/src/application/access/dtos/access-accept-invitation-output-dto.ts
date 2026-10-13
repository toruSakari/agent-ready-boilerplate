import { z } from "zod";

export const accessAcceptInvitationOutputDtoSchema = z.object({ scope: z.string() });

export const AccessAcceptInvitationOutputDto = accessAcceptInvitationOutputDtoSchema
  .brand<"AccessAcceptInvitationOutputDto">()
  .readonly();

export type AccessAcceptInvitationOutputDto = z.infer<typeof AccessAcceptInvitationOutputDto>;

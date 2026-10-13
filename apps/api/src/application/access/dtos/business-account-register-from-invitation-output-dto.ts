import { z } from "zod";

export const businessAccountRegisterFromInvitationOutputDtoSchema = z.object({ scope: z.string() });

export const BusinessAccountRegisterFromInvitationOutputDto =
  businessAccountRegisterFromInvitationOutputDtoSchema
    .brand<"BusinessAccountRegisterFromInvitationOutputDto">()
    .readonly();

export type BusinessAccountRegisterFromInvitationOutputDto = z.infer<
  typeof BusinessAccountRegisterFromInvitationOutputDto
>;

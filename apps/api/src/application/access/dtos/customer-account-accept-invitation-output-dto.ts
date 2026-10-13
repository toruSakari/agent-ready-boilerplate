import { z } from "zod";

export const customerAccountAcceptInvitationOutputDtoSchema = z.object({ scope: z.string() });

export const CustomerAccountAcceptInvitationOutputDto =
  customerAccountAcceptInvitationOutputDtoSchema
    .brand<"CustomerAccountAcceptInvitationOutputDto">()
    .readonly();

export type CustomerAccountAcceptInvitationOutputDto = z.infer<
  typeof CustomerAccountAcceptInvitationOutputDto
>;

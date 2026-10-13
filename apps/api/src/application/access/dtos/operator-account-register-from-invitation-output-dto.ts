import { z } from "zod";

export const operatorAccountRegisterFromInvitationOutputDtoSchema = z.object({ scope: z.string() });

export const OperatorAccountRegisterFromInvitationOutputDto =
  operatorAccountRegisterFromInvitationOutputDtoSchema
    .brand<"OperatorAccountRegisterFromInvitationOutputDto">()
    .readonly();

export type OperatorAccountRegisterFromInvitationOutputDto = z.infer<
  typeof OperatorAccountRegisterFromInvitationOutputDto
>;

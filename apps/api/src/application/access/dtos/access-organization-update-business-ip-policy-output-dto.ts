import { z } from "zod";

export const accessOrganizationUpdateBusinessIpPolicyOutputDtoSchema = z.object({
  ok: z.literal(true),
});

export const AccessOrganizationUpdateBusinessIpPolicyOutputDto =
  accessOrganizationUpdateBusinessIpPolicyOutputDtoSchema
    .brand<"AccessOrganizationUpdateBusinessIpPolicyOutputDto">()
    .readonly();

export type AccessOrganizationUpdateBusinessIpPolicyOutputDto = z.infer<
  typeof AccessOrganizationUpdateBusinessIpPolicyOutputDto
>;

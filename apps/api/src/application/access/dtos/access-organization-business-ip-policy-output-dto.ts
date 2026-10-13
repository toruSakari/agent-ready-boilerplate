import { z } from "zod";

export const accessOrganizationBusinessIpPolicyOutputDtoSchema = z.object({
  enabled: z.boolean(),
  allowedIps: z.array(z.string()),
});

export const AccessOrganizationBusinessIpPolicyOutputDto =
  accessOrganizationBusinessIpPolicyOutputDtoSchema
    .brand<"AccessOrganizationBusinessIpPolicyOutputDto">()
    .readonly();

export type AccessOrganizationBusinessIpPolicyOutputDto = z.infer<
  typeof AccessOrganizationBusinessIpPolicyOutputDto
>;

import { z } from "zod";

export const accessOrganizationAssertBusinessIpInputDtoSchema = z.object({
  scope: z.string(),
  clientIp: z.union([z.string(), z.null()]),
});

export const AccessOrganizationAssertBusinessIpInputDto =
  accessOrganizationAssertBusinessIpInputDtoSchema
    .brand<"AccessOrganizationAssertBusinessIpInputDto">()
    .readonly();

export type AccessOrganizationAssertBusinessIpInputDto = z.infer<
  typeof AccessOrganizationAssertBusinessIpInputDto
>;

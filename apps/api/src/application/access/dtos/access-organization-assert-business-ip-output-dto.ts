import { z } from "zod";

export const accessOrganizationAssertBusinessIpOutputDtoSchema = z.object({ ok: z.literal(true) });

export const AccessOrganizationAssertBusinessIpOutputDto =
  accessOrganizationAssertBusinessIpOutputDtoSchema
    .brand<"AccessOrganizationAssertBusinessIpOutputDto">()
    .readonly();

export type AccessOrganizationAssertBusinessIpOutputDto = z.infer<
  typeof AccessOrganizationAssertBusinessIpOutputDto
>;

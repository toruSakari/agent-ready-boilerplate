import { z } from "zod";

export const accessOrganizationUpdateOrganizationOutputDtoSchema = z.object({
  ok: z.literal(true),
});

export const AccessOrganizationUpdateOrganizationOutputDto =
  accessOrganizationUpdateOrganizationOutputDtoSchema
    .brand<"AccessOrganizationUpdateOrganizationOutputDto">()
    .readonly();

export type AccessOrganizationUpdateOrganizationOutputDto = z.infer<
  typeof AccessOrganizationUpdateOrganizationOutputDto
>;

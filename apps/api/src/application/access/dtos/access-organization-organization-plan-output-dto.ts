import { z } from "zod";

export const accessOrganizationOrganizationPlanOutputDtoSchema = z.object({
  code: z.union([z.string(), z.null()]),
});

export const AccessOrganizationOrganizationPlanOutputDto =
  accessOrganizationOrganizationPlanOutputDtoSchema
    .brand<"AccessOrganizationOrganizationPlanOutputDto">()
    .readonly();

export type AccessOrganizationOrganizationPlanOutputDto = z.infer<
  typeof AccessOrganizationOrganizationPlanOutputDto
>;

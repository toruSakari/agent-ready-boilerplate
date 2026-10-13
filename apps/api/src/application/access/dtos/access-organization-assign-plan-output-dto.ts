import { z } from "zod";

export const accessOrganizationAssignPlanOutputDtoSchema = z.object({ ok: z.literal(true) });

export const AccessOrganizationAssignPlanOutputDto = accessOrganizationAssignPlanOutputDtoSchema
  .brand<"AccessOrganizationAssignPlanOutputDto">()
  .readonly();

export type AccessOrganizationAssignPlanOutputDto = z.infer<
  typeof AccessOrganizationAssignPlanOutputDto
>;

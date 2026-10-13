import { z } from "zod";
import { authorizedActorSchema, planCategorySchema } from "#api/application/shared/dto-schemas.ts";

export const accessOrganizationAssignPlanInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  input: z.object({
    category: planCategorySchema,
    id: z.string(),
    planCode: z.union([z.string(), z.null()]),
  }),
});

export const AccessOrganizationAssignPlanInputDto = accessOrganizationAssignPlanInputDtoSchema
  .brand<"AccessOrganizationAssignPlanInputDto">()
  .readonly();

export type AccessOrganizationAssignPlanInputDto = z.infer<
  typeof AccessOrganizationAssignPlanInputDto
>;

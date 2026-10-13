import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessOrganizationOrganizationPlanInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  id: z.string(),
});

export const AccessOrganizationOrganizationPlanInputDto =
  accessOrganizationOrganizationPlanInputDtoSchema
    .brand<"AccessOrganizationOrganizationPlanInputDto">()
    .readonly();

export type AccessOrganizationOrganizationPlanInputDto = z.infer<
  typeof AccessOrganizationOrganizationPlanInputDto
>;

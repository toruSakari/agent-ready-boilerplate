import { z } from "zod";
import { authorizedActorSchema, planCategorySchema } from "#api/application/shared/dto-schemas.ts";

export const accessOrganizationListPlansInputDtoSchema = z.object({
  _identity: authorizedActorSchema,
  category: planCategorySchema,
});

export const AccessOrganizationListPlansInputDto = accessOrganizationListPlansInputDtoSchema
  .brand<"AccessOrganizationListPlansInputDto">()
  .readonly();

export type AccessOrganizationListPlansInputDto = z.infer<
  typeof AccessOrganizationListPlansInputDto
>;

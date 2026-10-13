import { z } from "zod";
import { planCategorySchema, permissionCodeSchema } from "#api/application/shared/dto-schemas.ts";

export const accessOrganizationListPlansOutputDtoSchema = z.object({
  items: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      category: planCategorySchema,
      permissions: z.array(permissionCodeSchema).readonly(),
    }),
  ),
});

export const AccessOrganizationListPlansOutputDto = accessOrganizationListPlansOutputDtoSchema
  .brand<"AccessOrganizationListPlansOutputDto">()
  .readonly();

export type AccessOrganizationListPlansOutputDto = z.infer<
  typeof AccessOrganizationListPlansOutputDto
>;

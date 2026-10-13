import { z } from "zod";

export const accessOrganizationListOrganizationsOutputDtoSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      active: z.boolean(),
      invitationsEnabled: z.boolean(),
      memberCount: z.number(),
    }),
  ),
});

export const AccessOrganizationListOrganizationsOutputDto =
  accessOrganizationListOrganizationsOutputDtoSchema
    .brand<"AccessOrganizationListOrganizationsOutputDto">()
    .readonly();

export type AccessOrganizationListOrganizationsOutputDto = z.infer<
  typeof AccessOrganizationListOrganizationsOutputDto
>;

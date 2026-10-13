import { z } from "zod";

export const accessOrganizationCreateOrganizationOutputDtoSchema = z.object({ id: z.string() });

export const AccessOrganizationCreateOrganizationOutputDto =
  accessOrganizationCreateOrganizationOutputDtoSchema
    .brand<"AccessOrganizationCreateOrganizationOutputDto">()
    .readonly();

export type AccessOrganizationCreateOrganizationOutputDto = z.infer<
  typeof AccessOrganizationCreateOrganizationOutputDto
>;

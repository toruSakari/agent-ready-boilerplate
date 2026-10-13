import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessOrganizationListOrganizationsInputDtoSchema = z.object({
  identity: authorizedActorSchema,
});

export const AccessOrganizationListOrganizationsInputDto =
  accessOrganizationListOrganizationsInputDtoSchema
    .brand<"AccessOrganizationListOrganizationsInputDto">()
    .readonly();

export type AccessOrganizationListOrganizationsInputDto = z.infer<
  typeof AccessOrganizationListOrganizationsInputDto
>;

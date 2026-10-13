import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessOrganizationUpdateOrganizationInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  input: z.object({
    id: z.string(),
    name: z.string(),
    active: z.boolean(),
    invitationsEnabled: z.boolean(),
  }),
});

export const AccessOrganizationUpdateOrganizationInputDto =
  accessOrganizationUpdateOrganizationInputDtoSchema
    .brand<"AccessOrganizationUpdateOrganizationInputDto">()
    .readonly();

export type AccessOrganizationUpdateOrganizationInputDto = z.infer<
  typeof AccessOrganizationUpdateOrganizationInputDto
>;

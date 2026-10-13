import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessOrganizationCreateOrganizationInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  input: z.object({ name: z.string() }),
});

export const AccessOrganizationCreateOrganizationInputDto =
  accessOrganizationCreateOrganizationInputDtoSchema
    .brand<"AccessOrganizationCreateOrganizationInputDto">()
    .readonly();

export type AccessOrganizationCreateOrganizationInputDto = z.infer<
  typeof AccessOrganizationCreateOrganizationInputDto
>;

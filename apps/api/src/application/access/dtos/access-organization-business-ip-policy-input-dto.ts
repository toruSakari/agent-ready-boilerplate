import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessOrganizationBusinessIpPolicyInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  id: z.string(),
});

export const AccessOrganizationBusinessIpPolicyInputDto =
  accessOrganizationBusinessIpPolicyInputDtoSchema
    .brand<"AccessOrganizationBusinessIpPolicyInputDto">()
    .readonly();

export type AccessOrganizationBusinessIpPolicyInputDto = z.infer<
  typeof AccessOrganizationBusinessIpPolicyInputDto
>;

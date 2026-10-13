import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessOrganizationUpdateBusinessIpPolicyInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  input: z.object({ id: z.string(), enabled: z.boolean(), allowedIps: z.array(z.string()) }),
});

export const AccessOrganizationUpdateBusinessIpPolicyInputDto =
  accessOrganizationUpdateBusinessIpPolicyInputDtoSchema
    .brand<"AccessOrganizationUpdateBusinessIpPolicyInputDto">()
    .readonly();

export type AccessOrganizationUpdateBusinessIpPolicyInputDto = z.infer<
  typeof AccessOrganizationUpdateBusinessIpPolicyInputDto
>;

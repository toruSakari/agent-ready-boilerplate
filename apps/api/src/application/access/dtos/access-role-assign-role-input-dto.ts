import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessRoleAssignRoleInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  input: z.object({ scope: z.string(), membershipId: z.string(), roleId: z.string() }),
});

export const AccessRoleAssignRoleInputDto = accessRoleAssignRoleInputDtoSchema
  .brand<"AccessRoleAssignRoleInputDto">()
  .readonly();

export type AccessRoleAssignRoleInputDto = z.infer<typeof AccessRoleAssignRoleInputDto>;

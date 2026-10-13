import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessRoleRolesInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  scope: z.string(),
});

export const AccessRoleRolesInputDto = accessRoleRolesInputDtoSchema
  .brand<"AccessRoleRolesInputDto">()
  .readonly();

export type AccessRoleRolesInputDto = z.infer<typeof AccessRoleRolesInputDto>;

import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessRoleRolePermissionCatalogInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  scope: z.string(),
});

export const AccessRoleRolePermissionCatalogInputDto = accessRoleRolePermissionCatalogInputDtoSchema
  .brand<"AccessRoleRolePermissionCatalogInputDto">()
  .readonly();

export type AccessRoleRolePermissionCatalogInputDto = z.infer<
  typeof AccessRoleRolePermissionCatalogInputDto
>;

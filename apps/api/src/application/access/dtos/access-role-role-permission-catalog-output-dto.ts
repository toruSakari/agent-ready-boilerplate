import { z } from "zod";
import { permissionLabelSchema } from "#api/application/shared/dto-schemas.ts";

export const accessRoleRolePermissionCatalogOutputDtoSchema = z.record(
  z.string(),
  permissionLabelSchema,
);

export const AccessRoleRolePermissionCatalogOutputDto =
  accessRoleRolePermissionCatalogOutputDtoSchema
    .brand<"AccessRoleRolePermissionCatalogOutputDto">()
    .readonly();

export type AccessRoleRolePermissionCatalogOutputDto = z.infer<
  typeof AccessRoleRolePermissionCatalogOutputDto
>;

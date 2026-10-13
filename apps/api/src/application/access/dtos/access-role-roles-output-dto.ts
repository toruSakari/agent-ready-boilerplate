import { z } from "zod";
import { permissionCodeSchema } from "#api/application/shared/dto-schemas.ts";

export const accessRoleRolesOutputDtoSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      protectedRole: z.boolean(),
      permissions: z.array(permissionCodeSchema).readonly(),
    }),
  ),
});

export const AccessRoleRolesOutputDto = accessRoleRolesOutputDtoSchema
  .brand<"AccessRoleRolesOutputDto">()
  .readonly();

export type AccessRoleRolesOutputDto = z.infer<typeof AccessRoleRolesOutputDto>;

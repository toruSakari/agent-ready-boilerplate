import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessRoleSaveRoleInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  input: z.object({
    scope: z.string(),
    id: z.union([z.string(), z.undefined()]).optional(),
    name: z.string(),
    permissions: z.array(z.string()).readonly(),
  }),
});

export const AccessRoleSaveRoleInputDto = accessRoleSaveRoleInputDtoSchema
  .brand<"AccessRoleSaveRoleInputDto">()
  .readonly();

export type AccessRoleSaveRoleInputDto = z.infer<typeof AccessRoleSaveRoleInputDto>;

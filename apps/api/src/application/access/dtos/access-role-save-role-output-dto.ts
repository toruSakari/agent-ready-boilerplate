import { z } from "zod";

export const accessRoleSaveRoleOutputDtoSchema = z.object({ id: z.string() });

export const AccessRoleSaveRoleOutputDto = accessRoleSaveRoleOutputDtoSchema
  .brand<"AccessRoleSaveRoleOutputDto">()
  .readonly();

export type AccessRoleSaveRoleOutputDto = z.infer<typeof AccessRoleSaveRoleOutputDto>;

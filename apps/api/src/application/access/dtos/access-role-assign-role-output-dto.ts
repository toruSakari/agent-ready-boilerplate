import { z } from "zod";

export const accessRoleAssignRoleOutputDtoSchema = z.object({ ok: z.literal(true) });

export const AccessRoleAssignRoleOutputDto = accessRoleAssignRoleOutputDtoSchema
  .brand<"AccessRoleAssignRoleOutputDto">()
  .readonly();

export type AccessRoleAssignRoleOutputDto = z.infer<typeof AccessRoleAssignRoleOutputDto>;

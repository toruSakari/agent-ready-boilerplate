import { z } from "zod";

export const accessRoleRemoveMemberOutputDtoSchema = z.object({ ok: z.literal(true) });

export const AccessRoleRemoveMemberOutputDto = accessRoleRemoveMemberOutputDtoSchema
  .brand<"AccessRoleRemoveMemberOutputDto">()
  .readonly();

export type AccessRoleRemoveMemberOutputDto = z.infer<typeof AccessRoleRemoveMemberOutputDto>;

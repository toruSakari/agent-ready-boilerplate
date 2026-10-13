import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessRoleRemoveMemberInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  input: z.object({ scope: z.string(), membershipId: z.string() }),
});

export const AccessRoleRemoveMemberInputDto = accessRoleRemoveMemberInputDtoSchema
  .brand<"AccessRoleRemoveMemberInputDto">()
  .readonly();

export type AccessRoleRemoveMemberInputDto = z.infer<typeof AccessRoleRemoveMemberInputDto>;

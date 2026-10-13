import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessDirectoryListMembersInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  scope: z.string(),
});

export const AccessDirectoryListMembersInputDto = accessDirectoryListMembersInputDtoSchema
  .brand<"AccessDirectoryListMembersInputDto">()
  .readonly();

export type AccessDirectoryListMembersInputDto = z.infer<typeof AccessDirectoryListMembersInputDto>;

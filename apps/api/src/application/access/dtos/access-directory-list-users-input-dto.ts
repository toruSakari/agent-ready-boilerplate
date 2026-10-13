import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessDirectoryListUsersInputDtoSchema = z.object({ identity: authorizedActorSchema });

export const AccessDirectoryListUsersInputDto = accessDirectoryListUsersInputDtoSchema
  .brand<"AccessDirectoryListUsersInputDto">()
  .readonly();

export type AccessDirectoryListUsersInputDto = z.infer<typeof AccessDirectoryListUsersInputDto>;

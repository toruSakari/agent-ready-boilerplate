import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessDirectorySessionInputDtoSchema = z.object({ identity: authorizedActorSchema });

export const AccessDirectorySessionInputDto = accessDirectorySessionInputDtoSchema
  .brand<"AccessDirectorySessionInputDto">()
  .readonly();

export type AccessDirectorySessionInputDto = z.infer<typeof AccessDirectorySessionInputDto>;

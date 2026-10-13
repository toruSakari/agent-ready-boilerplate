import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessRegistrationInputDtoSchema = z.object({ identity: authorizedActorSchema });

export const AccessRegistrationInputDto = accessRegistrationInputDtoSchema
  .brand<"AccessRegistrationInputDto">()
  .readonly();

export type AccessRegistrationInputDto = z.infer<typeof AccessRegistrationInputDto>;

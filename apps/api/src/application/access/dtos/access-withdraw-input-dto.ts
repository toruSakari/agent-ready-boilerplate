import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const accessWithdrawInputDtoSchema = z.object({ identity: authorizedActorSchema });

export const AccessWithdrawInputDto = accessWithdrawInputDtoSchema
  .brand<"AccessWithdrawInputDto">()
  .readonly();

export type AccessWithdrawInputDto = z.infer<typeof AccessWithdrawInputDto>;

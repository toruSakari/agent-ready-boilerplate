import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const businessAccountWithdrawInputDtoSchema = z.object({ identity: authorizedActorSchema });

export const BusinessAccountWithdrawInputDto = businessAccountWithdrawInputDtoSchema
  .brand<"BusinessAccountWithdrawInputDto">()
  .readonly();

export type BusinessAccountWithdrawInputDto = z.infer<typeof BusinessAccountWithdrawInputDto>;

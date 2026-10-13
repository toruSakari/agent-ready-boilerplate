import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const customerAccountWithdrawInputDtoSchema = z.object({ identity: authorizedActorSchema });

export const CustomerAccountWithdrawInputDto = customerAccountWithdrawInputDtoSchema
  .brand<"CustomerAccountWithdrawInputDto">()
  .readonly();

export type CustomerAccountWithdrawInputDto = z.infer<typeof CustomerAccountWithdrawInputDto>;

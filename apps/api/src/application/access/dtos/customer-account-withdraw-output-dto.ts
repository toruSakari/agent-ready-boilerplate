import { z } from "zod";

export const customerAccountWithdrawOutputDtoSchema = z.object({ category: z.literal("customer") });

export const CustomerAccountWithdrawOutputDto = customerAccountWithdrawOutputDtoSchema
  .brand<"CustomerAccountWithdrawOutputDto">()
  .readonly();

export type CustomerAccountWithdrawOutputDto = z.infer<typeof CustomerAccountWithdrawOutputDto>;

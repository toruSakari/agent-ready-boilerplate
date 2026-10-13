import { z } from "zod";

export const businessAccountWithdrawOutputDtoSchema = z.object({ category: z.literal("business") });

export const BusinessAccountWithdrawOutputDto = businessAccountWithdrawOutputDtoSchema
  .brand<"BusinessAccountWithdrawOutputDto">()
  .readonly();

export type BusinessAccountWithdrawOutputDto = z.infer<typeof BusinessAccountWithdrawOutputDto>;

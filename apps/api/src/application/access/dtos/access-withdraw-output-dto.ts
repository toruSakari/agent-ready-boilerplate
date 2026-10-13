import { z } from "zod";

export const accessWithdrawOutputDtoSchema = z.object({
  category: z.union([z.literal("business"), z.literal("customer"), z.literal("operator")]),
});

export const AccessWithdrawOutputDto = accessWithdrawOutputDtoSchema
  .brand<"AccessWithdrawOutputDto">()
  .readonly();

export type AccessWithdrawOutputDto = z.infer<typeof AccessWithdrawOutputDto>;

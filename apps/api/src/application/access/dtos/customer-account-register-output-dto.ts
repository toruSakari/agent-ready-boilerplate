import { z } from "zod";

export const customerAccountRegisterOutputDtoSchema = z.object({ accountId: z.string() });

export const CustomerAccountRegisterOutputDto = customerAccountRegisterOutputDtoSchema
  .brand<"CustomerAccountRegisterOutputDto">()
  .readonly();

export type CustomerAccountRegisterOutputDto = z.infer<typeof CustomerAccountRegisterOutputDto>;

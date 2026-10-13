import { z } from "zod";

export const accessRegisterCustomerOutputDtoSchema = z.object({ accountId: z.string() });

export const AccessRegisterCustomerOutputDto = accessRegisterCustomerOutputDtoSchema
  .brand<"AccessRegisterCustomerOutputDto">()
  .readonly();

export type AccessRegisterCustomerOutputDto = z.infer<typeof AccessRegisterCustomerOutputDto>;

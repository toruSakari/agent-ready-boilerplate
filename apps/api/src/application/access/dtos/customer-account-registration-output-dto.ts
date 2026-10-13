import { z } from "zod";

export const customerAccountRegistrationOutputDtoSchema = z.object({
  registered: z.boolean(),
  category: z.literal("customer"),
  accountId: z.union([z.string(), z.null()]),
});

export const CustomerAccountRegistrationOutputDto = customerAccountRegistrationOutputDtoSchema
  .brand<"CustomerAccountRegistrationOutputDto">()
  .readonly();

export type CustomerAccountRegistrationOutputDto = z.infer<
  typeof CustomerAccountRegistrationOutputDto
>;

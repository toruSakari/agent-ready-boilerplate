import { z } from "zod";

export const businessAccountRegistrationOutputDtoSchema = z.object({
  registered: z.boolean(),
  category: z.literal("business"),
  accountId: z.union([z.string(), z.null()]),
});

export const BusinessAccountRegistrationOutputDto = businessAccountRegistrationOutputDtoSchema
  .brand<"BusinessAccountRegistrationOutputDto">()
  .readonly();

export type BusinessAccountRegistrationOutputDto = z.infer<
  typeof BusinessAccountRegistrationOutputDto
>;

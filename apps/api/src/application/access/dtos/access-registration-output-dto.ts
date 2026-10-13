import { z } from "zod";

export const accessRegistrationOutputDtoSchema = z.object({
  registered: z.boolean(),
  category: z.union([z.literal("business"), z.literal("customer"), z.literal("operator")]),
  accountId: z.union([z.string(), z.null()]),
});

export const AccessRegistrationOutputDto = accessRegistrationOutputDtoSchema
  .brand<"AccessRegistrationOutputDto">()
  .readonly();

export type AccessRegistrationOutputDto = z.infer<typeof AccessRegistrationOutputDto>;

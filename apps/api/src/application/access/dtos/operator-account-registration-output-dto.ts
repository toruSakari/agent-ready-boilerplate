import { z } from "zod";

export const operatorAccountRegistrationOutputDtoSchema = z.object({
  registered: z.boolean(),
  category: z.literal("operator"),
  accountId: z.union([z.string(), z.null()]),
});

export const OperatorAccountRegistrationOutputDto = operatorAccountRegistrationOutputDtoSchema
  .brand<"OperatorAccountRegistrationOutputDto">()
  .readonly();

export type OperatorAccountRegistrationOutputDto = z.infer<
  typeof OperatorAccountRegistrationOutputDto
>;

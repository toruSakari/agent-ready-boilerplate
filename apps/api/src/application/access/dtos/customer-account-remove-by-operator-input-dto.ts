import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const customerAccountRemoveByOperatorInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  accountId: z.string(),
});

export const CustomerAccountRemoveByOperatorInputDto = customerAccountRemoveByOperatorInputDtoSchema
  .brand<"CustomerAccountRemoveByOperatorInputDto">()
  .readonly();

export type CustomerAccountRemoveByOperatorInputDto = z.infer<
  typeof CustomerAccountRemoveByOperatorInputDto
>;

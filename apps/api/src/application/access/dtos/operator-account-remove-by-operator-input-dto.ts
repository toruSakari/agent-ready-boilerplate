import { z } from "zod";
import { authorizedActorSchema } from "#api/application/shared/dto-schemas.ts";

export const operatorAccountRemoveByOperatorInputDtoSchema = z.object({
  identity: authorizedActorSchema,
  accountId: z.string(),
});

export const OperatorAccountRemoveByOperatorInputDto = operatorAccountRemoveByOperatorInputDtoSchema
  .brand<"OperatorAccountRemoveByOperatorInputDto">()
  .readonly();

export type OperatorAccountRemoveByOperatorInputDto = z.infer<
  typeof OperatorAccountRemoveByOperatorInputDto
>;

import { z } from "zod";

export const operatorAccountRemoveByOperatorOutputDtoSchema = z.object({ ok: z.literal(true) });

export const OperatorAccountRemoveByOperatorOutputDto =
  operatorAccountRemoveByOperatorOutputDtoSchema
    .brand<"OperatorAccountRemoveByOperatorOutputDto">()
    .readonly();

export type OperatorAccountRemoveByOperatorOutputDto = z.infer<
  typeof OperatorAccountRemoveByOperatorOutputDto
>;

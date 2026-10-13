import { z } from "zod";

export const customerAccountRemoveByOperatorOutputDtoSchema = z.object({ ok: z.literal(true) });

export const CustomerAccountRemoveByOperatorOutputDto =
  customerAccountRemoveByOperatorOutputDtoSchema
    .brand<"CustomerAccountRemoveByOperatorOutputDto">()
    .readonly();

export type CustomerAccountRemoveByOperatorOutputDto = z.infer<
  typeof CustomerAccountRemoveByOperatorOutputDto
>;

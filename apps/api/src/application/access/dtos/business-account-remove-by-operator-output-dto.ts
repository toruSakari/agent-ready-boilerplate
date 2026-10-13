import { z } from "zod";

export const businessAccountRemoveByOperatorOutputDtoSchema = z.object({ ok: z.literal(true) });

export const BusinessAccountRemoveByOperatorOutputDto =
  businessAccountRemoveByOperatorOutputDtoSchema
    .brand<"BusinessAccountRemoveByOperatorOutputDto">()
    .readonly();

export type BusinessAccountRemoveByOperatorOutputDto = z.infer<
  typeof BusinessAccountRemoveByOperatorOutputDto
>;

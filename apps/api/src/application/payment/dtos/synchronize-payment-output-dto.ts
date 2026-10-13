import { z } from "zod";

export const synchronizePaymentOutputDtoSchema = z.object({ ok: z.literal(true) });

export const SynchronizePaymentOutputDto = synchronizePaymentOutputDtoSchema
  .brand<"SynchronizePaymentOutputDto">()
  .readonly();

export type SynchronizePaymentOutputDto = z.infer<typeof SynchronizePaymentOutputDto>;

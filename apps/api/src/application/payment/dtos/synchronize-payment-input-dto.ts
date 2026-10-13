import type { z } from "zod";
import { settlementOrderSchema } from "#api/application/payment/dtos/synchronize-payment-input.ts";

export const synchronizePaymentInputDtoSchema = settlementOrderSchema;

export const SynchronizePaymentInputDto = synchronizePaymentInputDtoSchema
  .brand<"SynchronizePaymentInputDto">()
  .readonly();

export type SynchronizePaymentInputDto = z.infer<typeof SynchronizePaymentInputDto>;

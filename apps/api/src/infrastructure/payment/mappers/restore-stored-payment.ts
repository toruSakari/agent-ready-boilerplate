import { z } from "zod";
import {
  persistedText,
  persistedTimestamp,
} from "#api/infrastructure/shared/mappers/persisted-values.ts";
import { PaymentEntity } from "#api/domain/payment/entities/payment.ts";
import { InvalidPaymentError } from "#api/domain/payment/errors/invalid-payment-error.ts";
import { PaymentAmount } from "#api/domain/payment/value-objects/payment-amount.ts";
import { CurrencyCode } from "#api/domain/payment/value-objects/currency-code.ts";

const schema = z.object({
  id: persistedText,
  orderId: persistedText,
  amount: z.unknown().transform(PaymentAmount.create),
  currency: z.unknown().transform(CurrencyCode.create),
  status: z.enum(["pending", "authorized", "captured", "failed", "voided"]),
  authorizationId: persistedText.optional(),
  failureReason: persistedText.optional(),
  createdAt: persistedTimestamp,
  updatedAt: persistedTimestamp,
});

// 保存された状態・日時・金額を検証し、状態ごとの必須情報はPaymentの復元処理で確認する。
export function restoreStoredPayment(value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new InvalidPaymentError("支払いの識別情報・状態・日時が不正です");
  }

  return PaymentEntity.restore(result.data);
}

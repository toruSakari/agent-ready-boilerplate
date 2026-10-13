import { createValue } from "#api/domain/shared/create-value.ts";
import { z } from "zod";

// 支払い自体は正の整数額を必要とする。合計0の注文を決済対象にするかはユースケースが判断する。
const schema = z.number().int().min(1).brand<"PaymentAmount">();

export type PaymentAmount = z.output<typeof schema>;

export const PaymentAmount = Object.freeze({
  create(value: unknown): PaymentAmount {
    return createValue(
      (input) => schema.safeParse(input),
      value,
      "支払金額は1以上の整数にしてください",
    );
  },
});

import { createValue } from "#api/domain/shared/create-value.ts";
import { z } from "zod";

// 予約は必ず正数。在庫数の0許容や注文数量の上限とは別の制約として保つ。
const schema = z.number().int().min(1).brand<"ReservationQuantity">();

export type ReservationQuantity = z.output<typeof schema>;

export const ReservationQuantity = Object.freeze({
  create(value: unknown): ReservationQuantity {
    return createValue(
      (input) => schema.safeParse(input),
      value,
      "予約数は1以上の安全な整数にしてください",
    );
  },
});

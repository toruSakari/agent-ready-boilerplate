import { z } from "zod";
import {
  persistedText,
  persistedTimestamp,
} from "#api/infrastructure/shared/mappers/persisted-values.ts";
import { OrderEntity } from "#api/domain/order/entities/order.ts";
import { InvalidOrderError } from "#api/domain/order/errors/invalid-order-error.ts";
import { restoreStoredOrderLine } from "#api/infrastructure/order/mappers/restore-stored-order-line.ts";

const schema = z.object({
  id: persistedText,
  tenantId: persistedText,
  customerId: persistedText,
  status: z.enum(["draft", "confirmed", "shipped", "completed", "cancelled"]),
  lines: z.array(z.unknown().transform(restoreStoredOrderLine)),
  total: z.number(),
  version: z.number().int().min(0),
  createdAt: persistedTimestamp,
  reservationId: persistedText.nullable(),
});

// 保存形式・Value Objectを検証した後、明細合計や状態との整合性はOrderの復元処理へ委ねる。
export function restoreStoredOrder(value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new InvalidOrderError("注文の識別情報・状態・日時・更新番号が不正です");
  }

  return OrderEntity.restore(result.data);
}

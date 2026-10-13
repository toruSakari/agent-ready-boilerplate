import { z } from "zod";
import { createValue } from "#api/domain/shared/create-value.ts";

const schema = z.uuid().brand<"StockOperationId">();

export type StockOperationId = z.infer<typeof schema>;

export const StockOperationId = Object.freeze({
  create(value: unknown): StockOperationId {
    return createValue((input) => schema.safeParse(input), value, "在庫操作IDが不正です");
  },
});

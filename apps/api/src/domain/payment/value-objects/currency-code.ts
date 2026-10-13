import { createValue } from "#api/domain/shared/create-value.ts";
import { z } from "zod";

// 大文字3文字という形式だけを検証し、実在する通貨や決済事業者の対応通貨は保証しない。
const schema = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .brand<"CurrencyCode">();

export type CurrencyCode = z.output<typeof schema>;

export const CurrencyCode = Object.freeze({
  create(value: unknown): CurrencyCode {
    return createValue((input) => schema.safeParse(input), value, "通貨コードが不正です");
  },
});

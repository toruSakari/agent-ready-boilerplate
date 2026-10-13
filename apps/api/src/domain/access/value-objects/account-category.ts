import { createValue } from "#api/domain/shared/create-value.ts";
import { z } from "zod";
import { ACCOUNT_CATEGORIES } from "#api/domain/access/policies/account-categories.ts";
import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";

const schema = z.enum(ACCOUNT_CATEGORIES).brand<"AccountCategory">();

export type AccountCategory = z.output<typeof schema>;

export const AccountCategoryValue = Object.freeze({
  create(value: unknown): AccountCategory {
    return createValue((input) => schema.safeParse(input), value, "会員の登録種別が不正です");
  },
  toCode(value: AccountCategory): AccountCategoryCode {
    return value;
  },
});

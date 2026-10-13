import { z } from "zod";

/** 独立したサービスの登録種別。ロールや操作権限を表すものではない。 */
export const ACCOUNT_CATEGORIES = ["operator", "business", "customer"] as const;
export const accountCategorySchema = z.enum(ACCOUNT_CATEGORIES);

export type AccountCategoryCode = (typeof ACCOUNT_CATEGORIES)[number];

// 運営所属はplatformだけ、通常会員・企業担当者の所属は企業スコープだけに限定する。
export function categoryMatchesScope(category: AccountCategoryCode, scope: string) {
  return category === "operator" ? scope === "platform" : scope !== "platform";
}

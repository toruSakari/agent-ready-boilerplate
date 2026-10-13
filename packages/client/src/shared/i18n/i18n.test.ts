import { afterEach, expect, it } from "vite-plus/test";
import { english } from "#client/shared/i18n/en";
import {
  cookieName,
  getLocale,
  t as translate,
  errorMessage,
  setLocale,
  isLocale,
} from "#client/shared/i18n";
import { orderLinesSchema } from "#client/entities/order";
import { SERVICE_CATEGORY_LABELS, permissionLabel } from "#client/entities/access";
import { orderPaymentLabel } from "#client/entities/order/model/payment-label";

function useLanguage(locale: string) {
  if (isLocale(locale)) {
    setLocale(locale, { reload: false });
  } else {
    document.cookie = `${cookieName}=${locale}; path=/`;
  }
}

afterEach(() => {
  setLocale("ja", { reload: false });
  document.cookie = `${cookieName}=; path=/; max-age=0`;
});

it("言語と翻訳の契約" + " / " + "原文と英語の差し込み引数が一致する", () => {
  const parameters = (value: string) =>
    [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
  for (const [key, value] of Object.entries(english)) {
    expect(parameters(value), key).toEqual(parameters(key));
  }
});

it(
  "言語と翻訳の契約" + " / " + "日本語辞書なしで原文を表示し、未翻訳キーと区切り文字もそのまま扱う",
  () => {
    expect(translate("企業画面のIP制限")).toBe("企業画面のIP制限");
    useLanguage("en");
    expect(translate("企業画面のIP制限")).toBe("Business screen IP restrictions");
    expect(translate("未翻訳: v1.0 / {{name}}", { name: "<Taro>" })).toBe("未翻訳: v1.0 / <Taro>");
  },
);

it(
  "言語と翻訳の契約" + " / " + "未設定と未対応のCookieは日本語へ戻し、対応言語はそのまま使う",
  () => {
    expect(getLocale()).toBe("ja");
    useLanguage("unknown");
    expect(getLocale()).toBe("ja");
    useLanguage("en");
    expect(getLocale()).toBe("en");
    expect(translate("ログイン")).toBe("Sign in");
  },
);

it(
  "言語と翻訳の契約" +
    " / " +
    "モジュール評価済みのスキーマと表示ラベルも、検証・表示時の言語を使う",
  () => {
    useLanguage("en");
    const result = orderLinesSchema.safeParse([
      { sku: "", name: "商品名", quantity: 1, unitPrice: 1 },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Enter an SKU");
    }

    expect(SERVICE_CATEGORY_LABELS.customer).toBe("Shopper");
    expect(permissionLabel("order:read")).toBe("View orders");
    expect(orderPaymentLabel({ status: "confirmed", total: 10, paymentStatus: "authorized" })).toBe(
      "Authorized",
    );
    useLanguage("ja");
    expect(SERVICE_CATEGORY_LABELS.customer).toBe("一般ユーザー");
    expect(orderPaymentLabel({ status: "confirmed", total: 10, paymentStatus: "authorized" })).toBe(
      "承認済み",
    );
  },
);

it(
  "言語と翻訳の契約" +
    " / " +
    "APIコードを翻訳し、内部例外や未知のコード・prototypeキーを公開しない",
  () => {
    useLanguage("en");
    expect(errorMessage({ data: { errorCode: "FORBIDDEN" }, message: "secret SQL" })).toBe(
      "You do not have permission to perform this action",
    );
    for (const error of [
      new Error("secret SQL"),
      { data: { errorCode: "unknown" } },
      { data: { code: "toString" } },
    ]) {
      expect(errorMessage(error)).toBe("The operation failed. Please try again later");
    }
  },
);

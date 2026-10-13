import { getLocale } from "#client/shared/i18n/runtime";

/** 金額の通貨は業務データの属性であり、表示言語の変更で通貨を変換しない。 */
export function formatMoney(value: number, currency = "JPY") {
  return new Intl.NumberFormat(getLocale(), { style: "currency", currency }).format(value);
}

/** 日時のタイムゾーンを明示し、SSRとブラウザーの実行環境差を避ける。 */
export function formatDateTime(value: string | Date, timeZone = "Asia/Tokyo") {
  return new Intl.DateTimeFormat(getLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(typeof value === "string" ? new Date(value) : value);
}

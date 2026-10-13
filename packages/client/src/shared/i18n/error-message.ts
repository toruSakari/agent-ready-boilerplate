import { t as translate } from "#client/shared/i18n/runtime";

/** フロント自身が生成した公開文言だけを保持する。外部例外には使用しない。 */
export class UserFacingError extends Error {}

const errorMessages: Record<string, () => string> = {
  LAST_OWNER_REQUIRED: () =>
    translate(
      "最後のオーナー・運営管理者は削除・降格できません。先に同じサービスの会員へ権限を引き継いでください",
    ),
  INVITATION_INVALID: () => translate("招待が無効か期限切れです"),
  EMAIL_VERIFICATION_REQUIRED: () => translate("確認済みのメールアドレスが必要です"),
  STOCK_OPERATION_CONFLICT: () => translate("在庫操作が競合しています。画面を開き直してください"),
  STOCK_CHANGED: () => translate("在庫が変更されています。最新の在庫を確認してください"),
  STOCK_RESERVED: () =>
    translate("予約中の数量より少ない在庫には変更できません。最新の在庫を確認してください"),
  BAD_REQUEST: () => translate("入力内容が不正です。入力内容を確認してください"),
  UNAUTHORIZED: () => translate("認証が必要です。ログインし直してください"),
  FORBIDDEN: () => translate("この操作を行う権限がありません"),
  NOT_FOUND: () => translate("対象のデータが見つかりません"),
  CONFLICT: () => translate("データが競合しています。再読み込みしてください"),
  METHOD_NOT_SUPPORTED: () => translate("このリクエスト方法には対応していません"),
  PAYLOAD_TOO_LARGE: () => translate("送信データのサイズが大きすぎます"),
  TOO_MANY_REQUESTS: () => translate("リクエストが多すぎます。しばらくしてから再試行してください"),
  TIMEOUT: () => translate("処理がタイムアウトしました。しばらくしてから再試行してください"),
  INTERNAL_SERVER_ERROR: () => translate("処理に失敗しました。しばらくしてから再試行してください"),
};

function publicErrorCode(error: unknown): unknown {
  if (!error || typeof error !== "object" || !("data" in error)) {
    return undefined;
  }

  const data = error.data;
  if (!data || typeof data !== "object") {
    return undefined;
  }

  if ("errorCode" in data) {
    return data.errorCode;
  }

  if ("code" in data) {
    return data.code;
  }

  return undefined;
}

/** APIの安定したコードから翻訳する。例外本文や未知のコードは画面へ公開しない。 */
export function errorMessage(error: unknown): string {
  if (error instanceof UserFacingError) {
    return error.message;
  }

  const code = publicErrorCode(error);
  if (typeof code === "string" && Object.hasOwn(errorMessages, code)) {
    return errorMessages[code]!();
  }

  return translate("処理に失敗しました。しばらくしてから再試行してください");
}

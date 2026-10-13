import { defineLogEvent, logEvent } from "@dev-template/config/logging";
import { ApplicationError } from "#api/application/shared/application-error.ts";
import type { ApplicationErrorReason } from "#api/application/shared/application-error.ts";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";

export const apiFailureEvent = defineLogEvent("api_failed", "API処理に失敗しました", ["code"]);

const messages: Partial<Record<TRPCError["code"], string>> = {
  BAD_REQUEST: "入力内容が不正です。入力内容を確認してください",
  UNAUTHORIZED: "認証が必要です。ログインし直してください",
  FORBIDDEN: "この操作を行う権限がありません",
  NOT_FOUND: "対象のデータが見つかりません",
  CONFLICT: "データが競合しています。再読み込みしてください",
  METHOD_NOT_SUPPORTED: "このリクエスト方法には対応していません",
  PAYLOAD_TOO_LARGE: "送信データのサイズが大きすぎます",
  TOO_MANY_REQUESTS: "リクエストが多すぎます。しばらくしてから再試行してください",
  TIMEOUT: "処理がタイムアウトしました。しばらくしてから再試行してください",
};

export function publicErrorCode(error: TRPCError): TRPCError["code"] | ApplicationErrorReason {
  if (getHTTPStatusCodeFromError(error) >= 500) {
    return "INTERNAL_SERVER_ERROR";
  }

  if (error.cause instanceof ZodError) {
    return "BAD_REQUEST";
  }

  return error.cause instanceof ApplicationError ? (error.cause.reason ?? error.code) : error.code;
}

export function publicErrorMessage(error: TRPCError): string {
  const status = getHTTPStatusCodeFromError(error);
  if (status >= 500) {
    return "処理に失敗しました。しばらくしてから再試行してください";
  }

  if (error.cause instanceof ZodError) {
    return messages.BAD_REQUEST!;
  }

  // 5xxと入力検証エラーを除外したうえで、日本語の説明を残し既定英語文言を置き換える。
  return /[ぁ-んァ-ヶ一-龠]/u.test(error.message)
    ? error.message
    : (messages[error.code] ?? "リクエストを処理できませんでした");
}

// 既知の業務エラーのコード・文言をtRPCへ写し、未知の例外は内部障害として扱う。
// 応答へ公開する文言の秘匿はpublicErrorMessageが担う。
export function toRpcError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (error instanceof ApplicationError) {
    return new TRPCError({ code: error.code, message: error.message, cause: error });
  }

  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: error });
}

// 非RPCのHono応答も同じ公開文言・ステータス対応を使い、例外本文をログへ流さない。
export function apiErrorResponse(error: Error, context: Context): Response {
  const rpcError = toRpcError(error);
  const status = getHTTPStatusCodeFromError(rpcError) as ContentfulStatusCode;
  if (status >= 500) {
    logEvent("error", apiFailureEvent, { code: rpcError.code });
  }

  return context.json(
    { error: publicErrorMessage(rpcError), code: publicErrorCode(rpcError) },
    status,
  );
}

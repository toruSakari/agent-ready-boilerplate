import { rpcBatchSize } from "#api/presentation/shared/middleware/rpc-batch-size.ts";
import { MAX_RPC_BATCH_SIZE } from "#api/application/security/policies/request-limits.ts";
import { TRPC_ERROR_CODES_BY_KEY } from "@trpc/server/rpc";
import type { Context } from "hono";

/** tRPCクライアントも拒否理由を判定できるよう、認証前の拒否も同じエラー形式で返す。 */
export function throttleError(context: Context, status: 400 | 429 | 503, message: string) {
  const code = (
    { 429: "TOO_MANY_REQUESTS", 503: "SERVICE_UNAVAILABLE", 400: "BAD_REQUEST" } as const
  )[status];
  const error = {
    error: { message, code: TRPC_ERROR_CODES_BY_KEY[code], data: { code, httpStatus: status } },
  };
  const url = new URL(context.req.url);
  const calls = rpcBatchSize(url);
  // 超過バッチの応答も無制限には作らず、単一の拒否応答へまとめる。
  const body =
    url.searchParams.get("batch") === "1" && calls <= MAX_RPC_BATCH_SIZE
      ? Array.from({ length: calls }, () => error)
      : error;
  return context.json(body, status);
}

import type {} from "@tanstack/react-query";

interface QueryAccessMeta extends Record<string, unknown> {
  forbiddenBehavior?: "hide-section";
}

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: QueryAccessMeta;
  }
}

/** HTTPバッチ全体が207でも、手続きごとのtRPCエラーから権限拒否を判定する。 */
export function isForbiddenQueryError(error: unknown) {
  if (!error || typeof error !== "object" || !("data" in error)) {
    return false;
  }

  const data = error.data;
  return !!data && typeof data === "object" && "code" in data && data.code === "FORBIDDEN";
}

// 拒否済みの一覧はフォーカス復帰やポーリングで繰り返し要求しない。
// 権限更新後などに明示的にresetされるまで停止し、他の取得可能な部分は維持する。
export const perQueryAccessOptions = {
  meta: { forbiddenBehavior: "hide-section" as const },
  enabled: (query: { state: { error: unknown } }) => !isForbiddenQueryError(query.state.error),
};

/** 明示された任意一覧の403以外は、取得失敗を最寄りのBoundaryへ渡す。 */
export function shouldThrowQueryError(error: unknown, query: { meta?: QueryAccessMeta }) {
  return !(query.meta?.forbiddenBehavior === "hide-section" && isForbiddenQueryError(error));
}

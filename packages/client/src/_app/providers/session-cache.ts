import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { shouldThrowQueryError } from "#client/shared/api/query-access";
import {
  createAccessCacheHandlers,
  isAccessDenial,
} from "#client/_app/providers/access-cache-handlers";
import { QUERY_POLICY } from "#client/_app/providers/query-policy";

const sessionFilter = { queryKey: [["access", "session"]] };
const registrationFilter = { queryKey: [["access", "registration"]] };

export async function refreshAccessSession(client: QueryClient) {
  // 拒否より前に開始した取得を先に取り消し、遅れて成功しても旧権限を復活させない。
  await client.cancelQueries(sessionFilter);
  await client.invalidateQueries(sessionFilter);
}

/** 本人・サービス・企業の一スコープ専用。スコープ切替時は呼び出し元が作り直す。 */
export function createScopedQueryClient() {
  const { onSuccess, onError } = createAccessCacheHandlers(() => client, refreshAccessSession);
  const client = new QueryClient({
    queryCache: new QueryCache({
      onSuccess: (data, query) => onSuccess(data, query.queryKey),
      onError: (error, query) =>
        onError(error, query.queryKey, query.meta?.forbiddenBehavior === "hide-section"),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) =>
        onError(error, mutation.options.mutationKey),
    }),
    defaultOptions: {
      queries: {
        staleTime: QUERY_POLICY.staleTimeMs,
        // 任意の一覧の403だけは非表示へ縮退し、その他の取得失敗はBoundaryへ渡す。
        throwOnError: shouldThrowQueryError,
        retry: (failureCount, error) =>
          !isAccessDenial(error) && failureCount < QUERY_POLICY.retryAttempts,
      },
    },
  });
  // 資格の失敗を自動再試行で隠さず、タブ復帰・再接続では鮮度内でも現在の状態を確認する。
  for (const filter of [sessionFilter, registrationFilter]) {
    client.setQueryDefaults(filter.queryKey, {
      staleTime: QUERY_POLICY.sessionStaleTimeMs,
      retry: false,
      refetchOnWindowFocus: "always",
      refetchOnReconnect: "always",
    });
  }

  return client;
}

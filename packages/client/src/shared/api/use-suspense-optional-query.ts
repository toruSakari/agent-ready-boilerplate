import { t as translate } from "#client/shared/i18n";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { DefaultError, QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { isForbiddenQueryError } from "#client/shared/api/query-access";

/** 任意一覧をSuspenseで待つ。403は未取得と区別できるnullとし、他の取得失敗はthrowする。 */
export function useSuspenseOptionalQuery<
  TData,
  TError = DefaultError,
  TKey extends QueryKey = QueryKey,
>(
  options: Pick<UseQueryOptions<TData, TError, TData, TKey>, "queryKey" | "queryFn" | "meta">,
  props: { refetchInterval?: number | false } = {},
) {
  const result = useSuspenseQuery<TData | null, TError, TData | null, TKey>({
    queryKey: options.queryKey,
    meta: options.meta,
    // Suspenseはenabledを持たない。認証待ちなどの条件付き取得にはこのhookを使わない。
    queryFn: async (context) => {
      // invalidationでも拒否を繰り返さない。権限・会員変更によるresetでnullが解除されたら再照会する。
      if (context.client.getQueryData(context.queryKey) === null) {
        return null;
      }

      if (typeof options.queryFn !== "function") {
        throw new Error(translate("取得処理が設定されていません"));
      }

      try {
        return await options.queryFn(context);
      } catch (error) {
        if (isForbiddenQueryError(error)) {
          return null;
        }

        throw error;
      }
    },
    // 拒否済みの任意一覧は自動再取得しない。権限更新時の明示的なresetで解除する。
    refetchOnMount: (query) => query.state.data !== null,
    refetchOnWindowFocus: (query) => query.state.data !== null,
    refetchOnReconnect: (query) => query.state.data !== null,
    refetchInterval: (query) => (query.state.data === null ? false : props.refetchInterval),
  });
  // useSuspenseQueryの既定はキャッシュがある再取得エラーをthrowしない。古い値を表示させない。
  if (result.error) {
    throw result.error;
  }

  return result;
}

"use client";
import {
  useSuspenseOptionalQuery,
  useTRPC,
  perQueryAccessOptions,
  LIST_PAGE_SIZE,
  useCursorPagination,
} from "@dev-template/client/api";

import { useQueryClient } from "@tanstack/react-query";

// 商品一覧の403はこのセクションだけの拒否として扱い、画面全体の再検証ループを避ける。
export function useProducts(filters: { search?: string; sort?: "newest" | "oldest" } = {}) {
  const pagination = useCursorPagination();
  const trpc = useTRPC();
  const query = useSuspenseOptionalQuery(
    trpc.product.list.queryOptions(
      { ...filters, service: "business", limit: LIST_PAGE_SIZE, cursor: pagination.cursor },
      perQueryAccessOptions,
    ),
  );
  return {
    ...query,
    page: pagination.page,
    previousPage: pagination.previousPage,
    nextPage: () => pagination.nextPage(query.data ?? undefined),
    hasNextPage: query.data?.length === LIST_PAGE_SIZE,
  };
}

/** 商品登録・画像変更後にbusiness用の商品一覧を無効化する。企業の分離はProviderのQueryClientが担う。 */
export function useRefreshProducts() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.product.list.queryFilter({ service: "business" })),
      queryClient.invalidateQueries(trpc.product.get.queryFilter({ service: "business" })),
      queryClient.invalidateQueries(trpc.dashboard.summary.queryFilter()),
    ]);
  };
}

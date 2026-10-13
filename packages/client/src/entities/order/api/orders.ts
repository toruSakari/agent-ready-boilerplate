"use client";
import { ORDER_REFRESH_INTERVAL_MS } from "#client/entities/order/model/order-refresh-policy";
import { useSuspenseOptionalQuery } from "#client/shared/api/use-suspense-optional-query";
import { useCursorPagination } from "#client/shared/api/use-cursor-pagination";
import { LIST_PAGE_SIZE } from "#client/shared/api/pagination-policy";

import { useQueryClient } from "@tanstack/react-query";
import { useService } from "#client/shared/api/client-context";
import { perQueryAccessOptions } from "#client/shared/api/query-access";
import { useTRPC } from "#client/shared/api/trpc";

export function useOrders(
  filters: Omit<
    import("@dev-template/api-types").RouterInputs["order"]["list"],
    "service" | "limit" | "cursor"
  > = {},
) {
  const pagination = useCursorPagination();
  const trpc = useTRPC();
  const service = useService(["customer", "business"]);
  const query = useSuspenseOptionalQuery(
    {
      ...trpc.order.list.queryOptions(
        { ...filters, service, limit: LIST_PAGE_SIZE, cursor: pagination.cursor },
        perQueryAccessOptions,
      ),
      // 決済などの非同期反映を取り込む。拒否済みの一覧は共通hookが停止する。
    },
    { refetchInterval: ORDER_REFRESH_INTERVAL_MS },
  );
  return {
    ...query,
    page: pagination.page,
    previousPage: pagination.previousPage,
    nextPage: () => pagination.nextPage(query.data ?? undefined),
    hasNextPage: query.data?.length === LIST_PAGE_SIZE,
  };
}

// 同じサービスの一覧・詳細を更新する。企業間の分離は外側のQueryClientが担う。
export function useRefreshOrders() {
  const trpc = useTRPC();
  const service = useService(["customer", "business"]);
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries(trpc.order.list.queryFilter({ service })),
      queryClient.invalidateQueries(trpc.order.get.queryFilter({ service })),
      queryClient.invalidateQueries(trpc.dashboard.summary.queryFilter()),
    ]);
}

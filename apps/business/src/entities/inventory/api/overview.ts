import { useSuspenseQuery } from "@tanstack/react-query";
import {
  useTRPC,
  perQueryAccessOptions,
  LIST_PAGE_SIZE,
  useCursorPagination,
} from "@dev-template/client/api";

export function useInventoryList(
  filters: {
    search?: string;
    sort?: "newest" | "oldest";
    stock?: "in-stock" | "out-of-stock";
  } = {},
) {
  const trpc = useTRPC();
  const pagination = useCursorPagination();
  const query = useSuspenseQuery(
    trpc.inventory.list.queryOptions(
      { ...filters, limit: LIST_PAGE_SIZE, cursor: pagination.cursor },
      perQueryAccessOptions,
    ),
  );
  if (query.error) {
    throw query.error;
  }

  return {
    ...query,
    page: pagination.page,
    previousPage: pagination.previousPage,
    nextPage: () => pagination.nextPage(query.data),
    hasNextPage: query.data.length === LIST_PAGE_SIZE,
  };
}

export function useStockHistory(id: string) {
  const trpc = useTRPC();
  const pagination = useCursorPagination();
  const query = useSuspenseQuery(
    trpc.inventory.history.queryOptions(
      { id, limit: LIST_PAGE_SIZE, cursor: pagination.cursor },
      perQueryAccessOptions,
    ),
  );
  if (query.error) {
    throw query.error;
  }

  return {
    ...query,
    page: pagination.page,
    previousPage: pagination.previousPage,
    nextPage: () => pagination.nextPage(query.data),
    hasNextPage: query.data.length === LIST_PAGE_SIZE,
  };
}

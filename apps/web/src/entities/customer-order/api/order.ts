import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@dev-template/client/api";
import { ORDER_PAGE_SIZE } from "#web/entities/customer-order/model/order.ts";

export function useCustomerOrders(
  cursor?: { createdAt: string; id: string },
  filters: Omit<
    import("@dev-template/api-types").RouterInputs["store"]["listOrders"],
    "limit" | "cursor"
  > = {},
) {
  const trpc = useTRPC();
  const query = useSuspenseQuery(
    trpc.store.listOrders.queryOptions({ ...filters, limit: ORDER_PAGE_SIZE, cursor }),
  );
  if (query.error) {
    throw query.error;
  }

  return query;
}

export function useCustomerOrder(id: string) {
  const trpc = useTRPC();
  const query = useSuspenseQuery(trpc.store.getOrder.queryOptions({ id }));
  if (query.error) {
    throw query.error;
  }

  return query;
}

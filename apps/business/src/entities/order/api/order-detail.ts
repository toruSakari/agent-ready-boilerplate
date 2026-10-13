import { ORDER_REFRESH_INTERVAL_MS } from "@dev-template/client/entities/order";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC, perQueryAccessOptions } from "@dev-template/client/api";

export function useBusinessOrder(id: string) {
  const trpc = useTRPC();
  const query = useSuspenseQuery({
    ...trpc.order.get.queryOptions({ service: "business", id }, perQueryAccessOptions),
    // 操作後の同期更新に加え、Queueが後から反映する決済状態も取り込む。
    refetchInterval: ORDER_REFRESH_INTERVAL_MS,
  });
  if (query.error) {
    throw query.error;
  }

  return query.data;
}

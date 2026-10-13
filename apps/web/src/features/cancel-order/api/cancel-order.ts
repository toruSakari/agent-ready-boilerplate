import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@dev-template/client/api";

export function useCancelCustomerOrder() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.store.cancelOrder.mutationOptions({
      onSuccess: async (order) => {
        queryClient.setQueryData(trpc.store.getOrder.queryKey({ id: order.id }), (current) =>
          current ? { ...current, ...order } : undefined,
        );
        await Promise.all([
          queryClient.invalidateQueries(trpc.store.getOrder.queryFilter({ id: order.id })),
          queryClient.invalidateQueries(trpc.store.listOrders.queryFilter()),
          queryClient.invalidateQueries(trpc.store.list.queryFilter()),
          ...order.lines.map((line) =>
            queryClient.invalidateQueries(
              trpc.store.get.queryFilter({ tenantId: order.tenantId, sku: line.sku }),
            ),
          ),
        ]);
      },
    }),
  );
}

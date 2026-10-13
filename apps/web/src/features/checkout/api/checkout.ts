import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTRPC } from "@dev-template/client/api";
import { clearTenantCart } from "#web/entities/cart/index.ts";

export function useCheckout(tenantId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation(
    trpc.store.checkout.mutationOptions({
      onSuccess: async (order) => {
        clearTenantCart(tenantId);
        await queryClient.invalidateQueries(trpc.store.listOrders.queryFilter());
        await navigate({ to: "/orders/$orderId/complete", params: { orderId: order.id } });
      },
    }),
  );
}

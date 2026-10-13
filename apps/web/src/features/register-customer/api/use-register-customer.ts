"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@dev-template/client/api";
import type { ServiceRegistration } from "@dev-template/client/entities/access";

export function useRegisterCustomer() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.access.registerCustomer.mutationOptions({
      onSuccess: async (props) => {
        await queryClient.cancelQueries();
        // 再登録は別の会員IDになる。古い要求を止めてから未使用キャッシュを除き、セッションを再取得する。
        queryClient.removeQueries({ predicate: (query) => !query.isActive() });
        await queryClient.resetQueries(trpc.access.session.pathFilter());
        // 登録APIが返した新しい会員IDでこのサービスの登録表示を更新し、他サービスの登録は作らない。
        queryClient.setQueryData(trpc.access.registration.queryKey({ service: "customer" }), {
          registered: true,
          category: "customer",
          accountId: props.accountId,
        } satisfies ServiceRegistration);
      },
    }),
  );
}

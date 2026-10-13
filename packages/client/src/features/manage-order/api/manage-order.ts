"use client";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "#client/shared/api/trpc";
import { useRefreshOrders } from "#client/entities/order";

// 更新成功後はサーバーの更新番号・状態を一覧から取り直し、ローカルで状態遷移を推測しない。
export function useManageOrder() {
  const trpc = useTRPC();
  const refresh = useRefreshOrders();
  return {
    update: useMutation(trpc.order.update.mutationOptions({ onSuccess: refresh })),
    transition: useMutation(trpc.order.transition.mutationOptions({ onSuccess: refresh })),
  };
}

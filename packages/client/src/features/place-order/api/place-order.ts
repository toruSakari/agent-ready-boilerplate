"use client";

import { useMutation } from "@tanstack/react-query";
import { useRefreshOrders } from "#client/entities/order";
import { useTRPC } from "#client/shared/api/trpc";

// 一覧の更新は注文entityの公開APIへ委ね、作成操作側にキャッシュキーを複製しない。
export function usePlaceOrder() {
  const trpc = useTRPC();
  const refreshOrders = useRefreshOrders();
  return useMutation(trpc.order.create.mutationOptions({ onSuccess: refreshOrders }));
}

import type { RouterInputs } from "@dev-template/api-types";
import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useTRPC } from "@dev-template/client/api";
import { stockReasons } from "#business/entities/inventory/index.ts";
import type { StockOperation } from "#business/entities/inventory/index.ts";
import { stockFormSchema } from "#business/features/manage-stock/model/stock-form-schema.ts";

export function useStockForm(id: string, expectedStock: number, operation: StockOperation) {
  const trpc = useTRPC();
  const client = useQueryClient();
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const schema = stockFormSchema(operation);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      quantity: operation === "receive" ? Number.NaN : expectedStock,
      reason: stockReasons[operation][0]!,
    },
  });
  const refresh = () => client.invalidateQueries({ queryKey: trpc.inventory.get.queryKey({ id }) });
  const change = useMutation(
    trpc.inventory.adjust.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          refresh(),
          client.invalidateQueries(trpc.inventory.list.queryFilter()),
          client.invalidateQueries(trpc.inventory.history.queryFilter({ id })),
          client.invalidateQueries(trpc.store.list.queryFilter()),
          client.invalidateQueries(trpc.store.get.queryFilter()),
        ]);
      },
    }),
  );
  async function submit(values: z.infer<typeof schema>) {
    const adjustment = adjustmentInput(operation, expectedStock, values);
    const key = JSON.stringify(adjustment);
    // 同じ内容の通信再試行に同じIDを使い、応答が途切れても二重入荷にしない。
    if (attempt.current?.key !== key) {
      attempt.current = { key, id: crypto.randomUUID() };
    }

    try {
      await change.mutateAsync({ id, operationId: attempt.current.id, adjustment });
      attempt.current = null;
    } catch {
      /* 更新失敗は公開コードを表示し、入力を保持する。 */
    }
  }
  return {
    form,
    change,
    submit,
    refresh,
    pending: change.isPending || form.formState.isSubmitting,
  };
}

function adjustmentInput(
  operation: StockOperation,
  expectedStock: number,
  values: { quantity: number; reason: string },
): RouterInputs["inventory"]["adjust"]["adjustment"] {
  if (operation === "receive" && (values.reason === "delivery" || values.reason === "return")) {
    return { operation, quantity: values.quantity, reason: values.reason };
  }

  if (
    operation === "recount" &&
    (values.reason === "stocktake" || values.reason === "damage" || values.reason === "correction")
  ) {
    return { operation, quantity: values.quantity, reason: values.reason, expectedStock };
  }

  throw new Error("在庫操作の入力が不正です");
}

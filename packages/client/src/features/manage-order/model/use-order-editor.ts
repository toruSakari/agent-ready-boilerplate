"use client";
import { useService } from "#client/shared/api/client-context";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { OrderSnapshot } from "#client/entities/order";
import { useManageOrder } from "#client/features/manage-order/api/manage-order";

import { availableOrderActions } from "#client/features/manage-order/model/order-actions";
import { orderEditSchema } from "#client/features/manage-order/model/order-form";
import type { OrderEditValues } from "#client/features/manage-order/model/order-form";

export function useOrderEditor(order: OrderSnapshot) {
  const service = useService(["customer", "business"]);
  const { update, transition } = useManageOrder();
  const actions = availableOrderActions(order.status, service);
  const [editing, setEditing] = useState(false);
  // 数値入力の空欄はvalueAsNumberのNaNを保持し、編集スキーマで拒否する。
  const form = useForm<OrderEditValues>({
    resolver: zodResolver(orderEditSchema),
    defaultValues: { lines: order.lines },
  });
  // useFieldArrayのidで入力を追跡し、行を削除しても他の明細の入力状態を取り違えない。
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

  const pending = update.isPending || transition.isPending || form.formState.isSubmitting;
  const error = update.error ?? transition.error;
  async function save(data: OrderEditValues) {
    transition.reset();
    try {
      // 表示した時点のversionを送り、別操作による更新を黙って上書きしない。
      await update.mutateAsync({
        service,
        id: order.id,
        version: order.version,
        lines: data.lines,
      });
      setEditing(false);
    } catch {
      // エラー表示はMutationの状態を使い、失敗時は編集内容とエディターを残す。
    }
  }
  // 明細更新と状態遷移のエラーを混ぜず、今回の操作の結果だけを表示する。
  function move(status: "confirmed" | "cancelled" | "shipped" | "completed") {
    update.reset();
    transition.mutate({ service, id: order.id, version: order.version, status });
  }
  return {
    form,
    fields,
    append,
    remove,
    pending,
    error,
    editing,
    setEditing,
    actions,
    save,
    move,
    update,
    transition,
  };
}

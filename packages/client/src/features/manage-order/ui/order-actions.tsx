"use client";
import type { OrderSnapshot } from "#client/entities/order";
import { useOrderEditor } from "#client/features/manage-order/model/use-order-editor";
import { OrderEditForm } from "#client/features/manage-order/ui/order-edit-form";
import { OrderActionButtons } from "#client/features/manage-order/ui/order-action-buttons";
import { OrderMutationFeedback } from "#client/features/manage-order/ui/order-mutation-feedback";

/** 状態とサービスに応じた操作を接続する。所有権・競合はAPIが再検証する。 */
export function OrderActions(props: { order: OrderSnapshot }) {
  const editor = useOrderEditor(props.order);
  return (
    <div className="mt-4 grid gap-3">
      {editor.editing ? (
        <OrderEditForm editor={editor} />
      ) : (
        <OrderActionButtons editor={editor} order={props.order} />
      )}
      <OrderMutationFeedback editor={editor} />
    </div>
  );
}

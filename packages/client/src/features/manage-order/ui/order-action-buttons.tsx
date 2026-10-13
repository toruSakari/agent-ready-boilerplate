import { t as translate } from "#client/shared/i18n";
import { Button } from "@dev-template/ui/button";
import type { useOrderEditor } from "#client/features/manage-order/model/use-order-editor";
import type { OrderSnapshot } from "#client/entities/order";

export function OrderActionButtons(props: {
  editor: ReturnType<typeof useOrderEditor>;
  order: OrderSnapshot;
}) {
  const { actions, pending, form, update, transition, setEditing, move } = props.editor;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.edit ? (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              form.reset({ lines: props.order.lines });
              update.reset();
              transition.reset();
              setEditing(true);
            }}
          >
            {translate("明細を編集")}
          </Button>
          {actions.confirm && (
            <Button size="sm" disabled={pending} onClick={() => move("confirmed")}>
              {translate("注文を確定")}
            </Button>
          )}
        </>
      ) : null}
      {actions.ship ? (
        <Button size="sm" disabled={pending} onClick={() => move("shipped")}>
          {translate("出荷する")}
        </Button>
      ) : null}
      {actions.complete ? (
        <Button size="sm" disabled={pending} onClick={() => move("completed")}>
          {translate("注文を完了")}
        </Button>
      ) : null}
      {actions.cancel ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => move("cancelled")}>
          {translate("注文をキャンセル")}
        </Button>
      ) : null}
    </div>
  );
}

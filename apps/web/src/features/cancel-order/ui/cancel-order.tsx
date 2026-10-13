import { useState } from "react";
import { t, errorMessage } from "@dev-template/client/i18n";
import { Button } from "@dev-template/ui/button";
import { Alert, AlertDescription } from "@dev-template/ui/alert";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@dev-template/ui/alert-dialog";
import type { CustomerOrder } from "#web/entities/customer-order/index.ts";
import { canCancelCustomerOrder } from "#web/entities/customer-order/index.ts";
import { useCancelCustomerOrder } from "#web/features/cancel-order/api/cancel-order.ts";

export function CancelOrder(props: { order: CustomerOrder }) {
  const [open, setOpen] = useState(false);
  const cancel = useCancelCustomerOrder();
  if (!canCancelCustomerOrder(props.order)) {
    return null;
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (cancel.isPending) {
          return;
        }

        setOpen(next);
        if (next) {
          cancel.reset();
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline">{t("注文を取り消す")}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("この注文を取り消しますか？")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "取り消した注文は元に戻せません。商品を購入する場合は、あらためて注文してください。",
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {cancel.error && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(cancel.error)}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancel.isPending}>{t("戻る")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={cancel.isPending}
            onClick={(event) => {
              event.preventDefault();
              cancel.mutate(
                { id: props.order.id, version: props.order.version },
                { onSuccess: () => setOpen(false) },
              );
            }}
          >
            {cancel.isPending ? t("注文を取り消しています…") : t("注文の取消を確定する")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

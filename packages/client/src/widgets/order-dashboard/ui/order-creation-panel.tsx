import { t as translate, errorMessage } from "#client/shared/i18n";
import { usePermissions } from "#client/entities/access";
import { useService } from "#client/shared/api/client-context";
import type { OrderLine } from "#client/entities/order";
import { OrderForm, usePlaceOrder } from "#client/features/place-order";
import { Card } from "@dev-template/ui/card";
import { Alert, AlertDescription } from "@dev-template/ui/alert";

export function OrderCreationPanel() {
  const { can } = usePermissions();
  const service = useService(["customer", "business"]);
  const createOrder = usePlaceOrder();

  async function submit(lines: OrderLine[], draft?: boolean) {
    try {
      await createOrder.mutateAsync({ service, lines, draft });
    } catch {
      // 通信エラーはMutationの状態から表示し、フォームを消さず入力の再試行を可能にする。
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-highlight">
          {translate("注文サンプル")}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {translate("在庫を予約して注文")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {translate(
            "下書きで明細を編集し、確定時に在庫を予約します。確定後は出荷・完了へ進めるか、出荷前にキャンセルできます。",
          )}
        </p>
      </div>
      {service === "customer" && can("order:create") && (
        <OrderForm isPending={createOrder.isPending} onSubmit={submit} />
      )}
      {createOrder.error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{errorMessage(createOrder.error)}</AlertDescription>
        </Alert>
      ) : null}
    </Card>
  );
}

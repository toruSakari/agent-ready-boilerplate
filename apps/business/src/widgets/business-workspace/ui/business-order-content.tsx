import { t as translate, formatMoney } from "@dev-template/client/i18n";
import { usePermissions } from "@dev-template/client/entities/access";
import { OrderSummary } from "@dev-template/client/entities/order";
import { OrderActions } from "@dev-template/client/manage-order";
import { Card } from "@dev-template/ui/card";
import { useBusinessOrder } from "#business/entities/order/index.ts";

export function BusinessOrderContent(props: { id: string }) {
  const order = useBusinessOrder(props.id);
  const { can } = usePermissions();
  return (
    <div className="max-w-5xl space-y-6">
      <Card>
        <div className="border-b p-6">
          <p className="text-sm text-muted-foreground">{translate("注文ID")}</p>
          <h2 className="mt-2 break-all font-mono text-lg">{order.id}</h2>
        </div>
        <OrderSummary order={order}>
          {can("order:update") && <OrderActions order={order} />}
        </OrderSummary>
      </Card>
      <Card className="flex items-center justify-between p-6">
        <span className="font-medium">{translate("注文合計")}</span>
        <span className="text-2xl font-bold">{formatMoney(order.total)}</span>
      </Card>
    </div>
  );
}

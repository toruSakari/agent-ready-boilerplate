"use client";
import { OrderPagination } from "#client/widgets/order-dashboard/ui/order-pagination";
import { t as translate } from "#client/shared/i18n";
import { usePermissions } from "#client/entities/access";
import { OrderSummary, useOrders } from "#client/entities/order";
import { OrderActions } from "#client/features/manage-order";
import { Card } from "@dev-template/ui/card";
import { Badge } from "@dev-template/ui/badge";

export function OrderList() {
  const { can } = usePermissions();
  const orders = useOrders();
  return (
    <>
      {/* 一覧の403で作成フォームまで隠さず、各操作の可否を独立して扱う。 */}
      {orders.data !== null && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-6 py-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                D1 read model
              </p>
              <h2 className="mt-1 text-lg font-semibold">{translate("注文管理")}</h2>
            </div>
            <Badge variant="secondary" className="px-3 py-1 text-muted-foreground">
              {orders.data.length}
            </Badge>
          </div>
          <OrderPagination orders={orders} />
          <div className="divide-y divide-border">
            {orders.data.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">
                No orders yet. Place the first sample order.
              </p>
            ) : null}
            {orders.data.map((order) => (
              <OrderSummary order={order} key={order.id}>
                {can("order:update") && <OrderActions order={order} />}
              </OrderSummary>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

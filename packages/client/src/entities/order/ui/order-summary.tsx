import { t as translate, formatMoney } from "#client/shared/i18n";
import type { ReactNode } from "react";
import { Badge } from "@dev-template/ui/badge";
import type { OrderSnapshot } from "#client/entities/order/model/order";
import { orderStatusLabel } from "#client/entities/order/model/status-label";
import { orderPaymentLabel } from "#client/entities/order/model/payment-label";

/** 注文の表示だけを担う。変更操作はwidgetからchildrenで渡し、entitiesからfeaturesに依存しない。 */
export function OrderSummary(props: { order: OrderSnapshot; children?: ReactNode }) {
  return (
    <article className="px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          {props.order.lines.map((line) => (
            <div key={line.sku} className="mb-2">
              <p className="font-semibold">{line.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {translate("{{sku}} · Qty {{quantity}} · 単価 {{price}}", {
                  sku: line.sku,
                  quantity: line.quantity,
                  price: formatMoney(line.unitPrice),
                })}
              </p>
            </div>
          ))}
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {translate("{{id}} · 更新番号 {{version}}", {
              id: props.order.id,
              version: props.order.version,
            })}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{formatMoney(props.order.total)}</p>
          <Badge variant="outline" className="mt-1 border-success/40 text-success">
            {orderStatusLabel(props.order.status)}
          </Badge>
          <p className="mt-1 text-xs text-muted-foreground">
            {translate("デモ決済：{{payment}}", { payment: orderPaymentLabel(props.order) })}
          </p>
        </div>
      </div>
      {props.children}
    </article>
  );
}

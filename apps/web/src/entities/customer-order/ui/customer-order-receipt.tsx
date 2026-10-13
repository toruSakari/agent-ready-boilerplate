import { t, formatMoney, formatDateTime } from "@dev-template/client/i18n";
import { Card } from "@dev-template/ui/card";
import { Badge } from "@dev-template/ui/badge";
import { customerOrderStatus } from "#web/entities/customer-order/model/order.ts";
import type { CustomerOrder } from "#web/entities/customer-order/model/order.ts";

export function CustomerOrderReceipt(props: { order: CustomerOrder }) {
  return (
    <Card className="p-6 md:p-8">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {t("注文番号：{{id}}", { id: props.order.id })}
          </p>
          <p className="mt-2 text-sm">{formatDateTime(props.order.createdAt)}</p>
        </div>
        <Badge variant="secondary">{customerOrderStatus(props.order.status)}</Badge>
      </div>
      <div className="mt-6 divide-y border-t">
        {props.order.lines.map((line) => (
          <div key={line.sku} className="flex justify-between gap-5 py-5">
            <div>
              <p className="font-semibold">{line.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("数量：{{quantity}}", { quantity: line.quantity })}
              </p>
            </div>
            <p className="font-semibold">{formatMoney(line.unitPrice * line.quantity)}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-between border-t pt-5 text-xl font-bold">
        <span>{t("注文合計")}</span>
        <span>{formatMoney(props.order.total)}</span>
      </div>
      <p className="mt-6 rounded-lg bg-primary/10 p-4 text-sm text-highlight">
        {t("この環境はデモ注文です。実際の請求や配送は行われません。")}
      </p>
    </Card>
  );
}

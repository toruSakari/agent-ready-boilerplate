import { Link } from "@tanstack/react-router";
import { t, formatMoney, formatDateTime } from "@dev-template/client/i18n";
import { Button } from "@dev-template/ui/button";
import { Card } from "@dev-template/ui/card";
import { Badge } from "@dev-template/ui/badge";
import { customerOrderStatus } from "#web/entities/customer-order/model/order.ts";
import type { CustomerOrder } from "#web/entities/customer-order/model/order.ts";

export function CustomerOrderCard(props: { order: CustomerOrder }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap justify-between gap-5 bg-muted px-6 py-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{t("注文日")}</p>
          <p className="mt-1">{formatDateTime(props.order.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("合計")}</p>
          <p className="mt-1 font-semibold">{formatMoney(props.order.total)}</p>
        </div>
        <Badge variant="secondary">{customerOrderStatus(props.order.status)}</Badge>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-5 p-6">
        <div>
          <p className="font-semibold">{props.order.lines.map((line) => line.name).join(" / ")}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("注文番号：{{id}}", { id: props.order.id })}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/orders/$orderId" params={{ orderId: props.order.id }}>
            {t("注文の詳細を見る")}
          </Link>
        </Button>
      </div>
    </Card>
  );
}

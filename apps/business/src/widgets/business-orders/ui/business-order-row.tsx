import { t as translate, formatMoney } from "@dev-template/client/i18n";
import { Link } from "@tanstack/react-router";
import { Button } from "@dev-template/ui/button";
import { Badge } from "@dev-template/ui/badge";
import type { OrderSnapshot } from "@dev-template/client/entities/order";
import { orderListPresentation } from "#business/entities/order/index.ts";

export function BusinessOrderRow(props: { order: OrderSnapshot; organizationId: string }) {
  const presentation = orderListPresentation(props.order);
  return (
    <tr className="hover:bg-muted/30">
      <td className="p-4">
        <p className="font-medium">{presentation.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {translate("{{count}}種類の商品", {
            count: presentation.lineCount,
          })}
        </p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{props.order.id}</p>
      </td>
      <td className="p-4">
        <Badge variant="secondary">{presentation.status}</Badge>
      </td>
      <td className="whitespace-nowrap p-4 font-semibold">{formatMoney(props.order.total)}</td>
      <td className="p-4">
        <Button asChild variant="outline" size="sm">
          <Link
            to="/organizations/$organizationId/orders/$orderId"
            params={{ organizationId: props.organizationId, orderId: props.order.id }}
          >
            {translate("詳細を見る")}
          </Link>
        </Button>
      </td>
    </tr>
  );
}

import { orderStatusLabel } from "@dev-template/client/entities/order";
import type { OrderSnapshot } from "@dev-template/client/entities/order";
import { t as translate } from "@dev-template/client/i18n";

/** 一覧は代表商品と明細数だけを示し、全明細・操作は詳細画面へ委ねる。 */
export function orderListPresentation(order: OrderSnapshot) {
  return {
    title: order.lines[0]?.name ?? translate("注文"),
    lineCount: order.lines.length,
    status: orderStatusLabel(order.status),
  };
}

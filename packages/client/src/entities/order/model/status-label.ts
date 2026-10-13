import { t as translate } from "#client/shared/i18n";
import type { OrderSnapshot } from "#client/entities/order/model/order";

const statusLabels = {
  draft: () => translate("下書き"),
  confirmed: () => translate("確定"),
  shipped: () => translate("出荷済み"),
  completed: () => translate("完了"),
  cancelled: () => translate("キャンセル済み"),
} satisfies Record<OrderSnapshot["status"], () => string>;

export function orderStatusLabel(status: OrderSnapshot["status"]) {
  return statusLabels[status]();
}

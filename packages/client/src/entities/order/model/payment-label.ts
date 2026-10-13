import { t as translate } from "#client/shared/i18n";
import type { OrderSnapshot } from "#client/entities/order/model/order";

const paymentLabels: Record<string, () => string> = {
  pending: () => translate("処理待ち"),
  authorized: () => translate("承認済み"),
  captured: () => translate("売上確定"),
  voided: () => translate("取消済み"),
  failed: () => translate("失敗"),
};

/** 決済の一覧反映は非同期なので、未反映を未開始や失敗と混同しない。 */
export function orderPaymentLabel(
  order: Pick<OrderSnapshot, "status" | "total" | "paymentStatus">,
): string {
  if (order.status === "draft") {
    return translate("未開始");
  }

  if (order.total === 0) {
    return translate("支払い不要");
  }

  if (!order.paymentStatus) {
    return translate("反映待ち");
  }

  return paymentLabels[order.paymentStatus]?.() ?? order.paymentStatus;
}

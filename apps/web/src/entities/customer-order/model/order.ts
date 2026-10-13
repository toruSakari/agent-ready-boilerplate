import type { RouterOutputs } from "@dev-template/api-types";
import { t } from "@dev-template/client/i18n";

export type CustomerOrder = RouterOutputs["store"]["getOrder"];

export function customerOrderStatus(status: CustomerOrder["status"]) {
  const labels = {
    draft: () => t("下書き"),
    confirmed: () => t("注文受付済み"),
    shipped: () => t("発送済み"),
    completed: () => t("完了"),
    cancelled: () => t("キャンセル済み"),
  };
  return labels[status]();
}

export const ORDER_PAGE_SIZE = 20;

/** 本人の取消導線だけを示す。所有権・出荷状況・版の競合はAPIが最新状態で再検証する。 */
export function canCancelCustomerOrder(order: Pick<CustomerOrder, "status">) {
  return order.status === "draft" || order.status === "confirmed";
}

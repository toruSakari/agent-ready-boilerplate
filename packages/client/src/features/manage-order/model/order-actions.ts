import type { OrderSnapshot } from "#client/entities/order";

/** 操作候補の表示専用。現在権限・所有権・状態遷移はAPIが再検証する。 */
export function availableOrderActions(
  status: OrderSnapshot["status"],
  service: "customer" | "business",
) {
  const draft = status === "draft";
  return {
    edit: draft,
    confirm: draft,
    ship: status === "confirmed" && service === "business",
    complete: status === "shipped" && service === "business",
    cancel: draft || status === "confirmed",
  };
}

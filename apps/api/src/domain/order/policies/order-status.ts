export const ORDER_STATUS_CODES = [
  "draft",
  "confirmed",
  "shipped",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUS_CODES)[number];

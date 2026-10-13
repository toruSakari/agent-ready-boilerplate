import type { OrderLine } from "#client/entities/order";
import { ORDER_INPUT_LIMITS } from "#client/shared/config/input-limits";

// テンプレートで試すための初期明細。商品マスターやサーバーの価格決定ルールを表すものではない。
export const DEFAULT_ORDER_LINE: OrderLine = Object.freeze({
  sku: "SKU-EDGE-MUG",
  name: "Edge Mug",
  quantity: ORDER_INPUT_LIMITS.quantityMin,
  unitPrice: 2_400,
});

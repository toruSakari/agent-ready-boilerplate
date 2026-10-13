import { useSyncExternalStore } from "react";
import { z } from "zod";
import { CATALOG_INPUT_LIMITS, ORDER_INPUT_LIMITS } from "@dev-template/client/config";

export const CART_STORAGE_KEY = "customer-store-cart-v1";
export const CART_QUANTITY_LIMIT = ORDER_INPUT_LIMITS.quantityMax;
const lineSchema = z.object({
  tenantId: z.string().min(1),
  sku: z.string().min(CATALOG_INPUT_LIMITS.textMinLength).max(CATALOG_INPUT_LIMITS.skuMaxLength),
  name: z.string().min(CATALOG_INPUT_LIMITS.textMinLength).max(CATALOG_INPUT_LIMITS.nameMaxLength),
  unitPrice: z
    .number()
    .int()
    .min(CATALOG_INPUT_LIMITS.unitPriceMin)
    .max(CATALOG_INPUT_LIMITS.unitPriceMax),
  quantity: z.number().int().min(1).max(CART_QUANTITY_LIMIT),
});

export type CartLine = z.infer<typeof lineSchema>;

let lines: CartLine[] = [];
let initialized = false;
const empty: CartLine[] = [];
const listeners = new Set<() => void>();

function initialize() {
  if (initialized || typeof window === "undefined") {
    return;
  }

  initialized = true;
  try {
    const result = z
      .array(lineSchema)
      .safeParse(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? "[]"));
    if (result.success) {
      lines = result.data;
    }
  } catch {
    /* 保存値が壊れている場合は空のカートから再開する。 */
  }
}

function publish(next: CartLine[]) {
  lines = next;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 保存不可でも現在のタブで購入操作を継続できる。 */
  }

  for (const listener of listeners) {
    listener();
  }
}

export function addToCart(line: Omit<CartLine, "quantity">, quantity = 1) {
  initialize();
  const existing = lines.find((item) => item.tenantId === line.tenantId && item.sku === line.sku);
  const next = lineSchema.parse({
    ...line,
    quantity: Math.min(CART_QUANTITY_LIMIT, (existing?.quantity ?? 0) + quantity),
  });
  publish([...lines.filter((item) => item !== existing), next]);
}

export function setCartQuantity(tenantId: string, sku: string, quantity: number) {
  publish(
    lines.map((line) =>
      line.tenantId === tenantId && line.sku === sku
        ? lineSchema.parse({ ...line, quantity })
        : line,
    ),
  );
}

export function removeCartLine(tenantId: string, sku: string) {
  publish(lines.filter((line) => line.tenantId !== tenantId || line.sku !== sku));
}

export function clearTenantCart(tenantId: string) {
  publish(lines.filter((line) => line.tenantId !== tenantId));
}

export function useCart() {
  return useSyncExternalStore(
    (listener) => {
      initialize();
      listeners.add(listener);
      listener();
      return () => listeners.delete(listener);
    },
    () => lines,
    () => empty,
  );
}

export function cartTotal(cart: CartLine[]) {
  return cart.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
}

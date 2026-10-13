import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});
afterEach(() => cleanup());
describe("購入者のカート", () => {
  it("同じ販売元の商品だけ数量をまとめ、購入した販売元以外を保持する", async () => {
    const cart = await import("#web/entities/cart/model/cart.ts");
    const { result } = renderHook(() => cart.useCart());
    act(() => {
      cart.addToCart({ tenantId: "first", sku: "item", name: "商品", unitPrice: 500 });
      cart.addToCart({ tenantId: "first", sku: "item", name: "商品", unitPrice: 500 }, 2);
      cart.addToCart({ tenantId: "second", sku: "item", name: "別販売元", unitPrice: 0 });
    });
    expect(result.current).toHaveLength(2);
    expect(result.current[0]?.quantity).toBe(3);
    expect(cart.cartTotal(result.current)).toBe(1500);
    act(() => cart.clearTenantCart("first"));
    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.tenantId).toBe("second");
  });
  it("保存値が不正なら注文入力へ引き継がない", async () => {
    const cart = await import("#web/entities/cart/model/cart.ts");
    localStorage.setItem(
      cart.CART_STORAGE_KEY,
      JSON.stringify([
        { tenantId: "first", sku: "item", name: "不正", unitPrice: -1, quantity: 1 },
      ]),
    );
    const { result } = renderHook(() => cart.useCart());
    expect(result.current).toEqual([]);
  });
  it("数量更新と削除を保存し、無効な数量を拒否する", async () => {
    const cart = await import("#web/entities/cart/model/cart.ts");
    const { result } = renderHook(() => cart.useCart());
    act(() => cart.addToCart({ tenantId: "first", sku: "item", name: "商品", unitPrice: 500 }));
    expect(() => cart.setCartQuantity("first", "item", 0)).toThrow();
    act(() => cart.setCartQuantity("first", "item", 3));
    expect(result.current[0]?.quantity).toBe(3);
    expect(JSON.parse(localStorage.getItem(cart.CART_STORAGE_KEY) ?? "[]")[0].quantity).toBe(3);
    act(() => cart.removeCartLine("first", "item"));
    expect(result.current).toEqual([]);
  });
});

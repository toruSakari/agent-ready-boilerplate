import { expect, it } from "vite-plus/test";
import { OrderLine } from "#api/domain/order/entities/order-line.ts";
import { OrderEntity } from "#api/domain/order/entities/order.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { ProductName } from "#api/domain/shared/value-objects/product-name.ts";
import { UnitPrice } from "#api/domain/shared/value-objects/unit-price.ts";
import { OrderQuantity } from "#api/domain/order/value-objects/order-quantity.ts";

it("注文明細をクラスとして凍結し、Snapshotはプリミティブのデータだけを返す", () => {
  const line = new OrderLine(
    Sku.create("sku"),
    ProductName.create("商品"),
    OrderQuantity.create(2),
    UnitPrice.create(100),
  );
  const snapshot = line.toSnapshot();
  expect(Object.isFrozen(line)).toBe(true);
  expect(Reflect.set(line, "quantity", 3)).toBe(false);
  expect(snapshot).toStrictEqual({ sku: "sku", name: "商品", quantity: 2, unitPrice: 100 });
  expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype);
});

it("注文の作成と状態遷移で明細のクラスと操作を維持する", () => {
  const line = new OrderLine(
    Sku.create("sku"),
    ProductName.create("商品"),
    OrderQuantity.create(2),
    UnitPrice.create(100),
  );
  const draft = OrderEntity.draft({
    id: "order",
    tenantId: "tenant",
    customerId: "customer",
    lines: [line],
    now: "2026-10-12T00:00:00.000Z",
    eventId: "created",
  });
  const confirmed = draft.confirm({ now: "2026-10-12T00:00:01.000Z", eventId: "confirmed" });
  expect(draft.lines[0]).toBeInstanceOf(OrderLine);
  expect(confirmed.lines[0]).toBeInstanceOf(OrderLine);
  expect(confirmed.toSnapshot().lines).toStrictEqual([line.toSnapshot()]);
});

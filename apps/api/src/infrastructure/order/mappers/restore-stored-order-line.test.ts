import { expect, it } from "vite-plus/test";
import { OrderLine } from "#api/domain/order/entities/order-line.ts";
import { restoreStoredOrderLine } from "#api/infrastructure/order/mappers/restore-stored-order-line.ts";

it("保存明細をブランド値を保持したOrderLineクラスに復元する", () => {
  const input = { sku: "sku", name: "商品", quantity: 2, unitPrice: 100 };
  const line = restoreStoredOrderLine(input);
  expect(line).toBeInstanceOf(OrderLine);
  input.name = "変更";
  expect(line.toSnapshot()).toStrictEqual({
    sku: "sku",
    name: "商品",
    quantity: 2,
    unitPrice: 100,
  });
});

it.each([
  null,
  [],
  { sku: "", name: "商品", quantity: 1, unitPrice: 100 },
  { sku: "sku", name: "", quantity: 1, unitPrice: 100 },
  { sku: "sku", name: "商品", quantity: 0, unitPrice: 100 },
  { sku: "sku", name: "商品", quantity: 1, unitPrice: -1 },
])("不正な保存明細からEntityを生成しない: %j", (input) => {
  expect(() => restoreStoredOrderLine(input)).toThrow();
});

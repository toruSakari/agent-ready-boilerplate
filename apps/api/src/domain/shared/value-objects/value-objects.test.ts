import { describe, expect, it } from "vite-plus/test";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { ProductName } from "#api/domain/shared/value-objects/product-name.ts";
import { UnitPrice } from "#api/domain/shared/value-objects/unit-price.ts";
import { OrderQuantity } from "#api/domain/order/value-objects/order-quantity.ts";
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { ReservationQuantity } from "#api/domain/inventory/value-objects/reservation-quantity.ts";
import { PaymentAmount } from "#api/domain/payment/value-objects/payment-amount.ts";
import { CurrencyCode } from "#api/domain/payment/value-objects/currency-code.ts";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";

// 期待する境界値は実装定数から計算せず固定し、制約の意図しない変更も検出する。
const numericObjects = [
  { name: "注文数量", create: (v: unknown) => OrderQuantity.create(v), min: 1, max: 100 },
  { name: "単価", create: (v: unknown) => UnitPrice.create(v), min: 0, max: 10_000_000 },
  {
    name: "在庫数",
    create: (v: unknown) => StockQuantity.create(v),
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
  },
  {
    name: "予約数",
    create: (v: unknown) => ReservationQuantity.create(v),
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
  },
  {
    name: "支払金額",
    create: (v: unknown) => PaymentAmount.create(v),
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
  },
];
describe.each(numericObjects)("$nameの値ルール", (props) => {
  it.each([props.min, props.max])("境界の値 %s を検証済みの数値として受け入れる", (value) => {
    const result = props.create(value);
    expect(result).toBe(value);
    expect(typeof result).toBe("number");
    expect(JSON.stringify(result)).toBe(JSON.stringify(value));
  });
  it.each([null, "1", NaN, Infinity, 1.5, props.min - 1, props.max + 1])(
    "不正な値 %s を拒否する",
    (value) => {
      expect(() => props.create(value)).toThrow(InvalidValueObjectError);
    },
  );
});
const textObjects = [
  {
    name: "SKU",
    create: (v: unknown) => Sku.create(v),
    valid: "s".repeat(64),
    invalid: "s".repeat(65),
  },
  {
    name: "商品名",
    create: (v: unknown) => ProductName.create(v),
    valid: "名".repeat(120),
    invalid: "名".repeat(121),
  },
  { name: "通貨", create: (v: unknown) => CurrencyCode.create(v), valid: "JPY", invalid: "jpy" },
];
describe.each(textObjects)("$nameの文字列ルール", (props) => {
  it("有効な値を検証済みの文字列として受け入れる", () => {
    expect(props.create(props.valid)).toBe(props.valid);
    expect(typeof props.create(props.valid)).toBe("string");
  });
  it.each([null, 1, "", " ", props.invalid])("不正な値 %s を拒否する", (value) => {
    expect(() => props.create(value)).toThrow(InvalidValueObjectError);
  });
});
it("プリミティブ値で等価を判断し、数量の用途を区別する", () => {
  expect(Sku.create("s1") === Sku.create("s1")).toBe(true);
  expect(UnitPrice.create(100) === UnitPrice.create(101)).toBe(false);
  expect(OrderQuantity.create(2) === OrderQuantity.create(2)).toBe(true);
  expect(() => OrderQuantity.create(101)).toThrow(InvalidValueObjectError);
  expect(ReservationQuantity.create(101)).toBe(101);
  expect(StockQuantity.create(0)).toBe(0);
  expect(() => ReservationQuantity.create(0)).toThrow(InvalidValueObjectError);
});

it("数量の演算結果は再検証し、上限を超えた値をブランド付き数量にしない", () => {
  const quantity = OrderQuantity.create(100);
  const next = quantity + 1;
  expect(() => OrderQuantity.create(next)).toThrow(InvalidValueObjectError);
});

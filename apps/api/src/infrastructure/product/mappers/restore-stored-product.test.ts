import { describe, expect, it } from "vite-plus/test";
import { restoreStoredProduct } from "#api/infrastructure/product/mappers/restore-stored-product.ts";

const base = {
  id: "p1",
  tenantId: "t1",
  sku: "s1",
  name: "マグ",
  unitPrice: 500,
  imageKey: null,
  images: [],
  createdAt: "2026-10-02",
};
describe("保存データの復元境界", () => {
  it.each([
    null,
    { ...base, unitPrice: -1 },
    { ...base, imageKey: "" },
    { ...base, tenantId: "" },
    { ...base, images: [{ id: "i1", key: "", createdAt: "2026-10-02" }] },
    { ...base, images: [{ id: "i1", key: "key", createdAt: "invalid" }] },
    { ...base, createdAt: "invalid" },
  ])("不正な保存データを拒否する", (value) => {
    expect(() => restoreStoredProduct(value)).toThrow();
  });
});

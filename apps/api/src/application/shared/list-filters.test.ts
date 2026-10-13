import { expect, it } from "vite-plus/test";
import {
  listFiltersSchema,
  orderFiltersSchema,
  storeFiltersSchema,
  inventoryFiltersSchema,
} from "#api/domain/shared/list-filters.ts";

it("不正な状態・日付・検索長・金額を拒否する", () => {
  expect(orderFiltersSchema.safeParse({ status: "paid" }).success).toBe(false);
  expect(orderFiltersSchema.safeParse({ from: "2026-02-30" }).success).toBe(false);
  expect(orderFiltersSchema.safeParse({ from: "2026-10-12", to: "2026-10-11" }).success).toBe(
    false,
  );
  expect(listFiltersSchema.safeParse({ search: "a".repeat(101) }).success).toBe(false);
  expect(inventoryFiltersSchema.safeParse({ stock: "low" }).success).toBe(false);
  for (const input of [{ minPrice: -1 }, { maxPrice: 0.5 }, { minPrice: 2, maxPrice: 1 }]) {
    expect(storeFiltersSchema.safeParse(input).success).toBe(false);
  }

  expect(storeFiltersSchema.parse({ minPrice: 0, maxPrice: 0 })).toEqual({
    minPrice: 0,
    maxPrice: 0,
  });
});

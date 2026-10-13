import { expect, it } from "vite-plus/test";
import {
  orderListSearchSchema,
  storeListSearchSchema,
  organizationListSearchSchema,
} from "#client/widgets/list-filters/model/list-search.ts";

it("URLの検索条件を検証し、不正な状態と逆転した期間・価格を拒否する", () => {
  expect(orderListSearchSchema.parse({ q: " 注文 ", status: "confirmed", sort: "oldest" })).toEqual(
    { q: "注文", status: "confirmed", sort: "oldest" },
  );
  expect(orderListSearchSchema.safeParse({ status: "active" }).success).toBe(false);
  expect(orderListSearchSchema.safeParse({ from: "2026-10-12", to: "2026-10-11" }).success).toBe(
    false,
  );
  expect(storeListSearchSchema.parse({ minPrice: "0", maxPrice: "100" })).toEqual({
    minPrice: 0,
    maxPrice: 100,
  });
  expect(storeListSearchSchema.safeParse({ minPrice: "200", maxPrice: "100" }).success).toBe(false);
  expect(storeListSearchSchema.safeParse({ minPrice: true }).success).toBe(false);
  expect(storeListSearchSchema.safeParse({ minPrice: "" }).success).toBe(false);
  expect(organizationListSearchSchema.safeParse({ status: "confirmed" }).success).toBe(false);
});

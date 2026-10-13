import { ROUTE_PARAM_LIMITS } from "@dev-template/client/route-params";
import { ACCESS_FORM_LIMITS } from "#client/features/manage-access";
import { ACCESS_LIMITS } from "#api/domain/access/policies/access-limits.ts";
import { expect, it } from "vite-plus/test";
import { CATALOG_INPUT_LIMITS, ORDER_INPUT_LIMITS } from "#client/shared/config/input-limits";
import { PRODUCT_IMAGE_LIMITS } from "#business/entities/product/index.ts";
import { SKU_LIMITS } from "#api/domain/shared/value-objects/sku.ts";
import { PRODUCT_NAME_LIMITS } from "#api/domain/shared/value-objects/product-name.ts";
import { UNIT_PRICE_LIMITS } from "#api/domain/shared/value-objects/unit-price.ts";
import { ORDER_QUANTITY_LIMITS } from "#api/domain/order/value-objects/order-quantity.ts";
import { ORDER_LINE_LIMITS } from "#api/domain/order/entities/order.ts";
import { PRODUCT_IMAGE_MAX_COUNT } from "#api/domain/product/entities/product.ts";
import { MAX_IMAGE_BYTES } from "#api/application/product/policies/image-policy.ts";

import { BUSINESS_IP_MAX_ENTRIES } from "#api/domain/access/entities/organization.ts";
import { BUSINESS_IP_FORM_MAX_ENTRIES } from "#admin/features/manage-organizations/model/business-ip-form.ts";

import { LIST_PAGE_SIZE } from "#client/shared/api/pagination-policy";
import { PAGE_LIMITS, paginationSchema } from "#api/application/shared/pagination.ts";

import { LIST_SEARCH_LIMITS } from "@dev-template/client/config";
import { LIST_FILTER_LIMITS } from "#api/domain/shared/list-filters.ts";

// クライアントへdomainを取り込まず、別々の所有元が公開する上限の一致だけをルートで照合する。
it("クライアントの入力補助とサーバーの制約が一致する", () => {
  expect(CATALOG_INPUT_LIMITS).toEqual({
    textMinLength: SKU_LIMITS.minLength,
    skuMaxLength: SKU_LIMITS.maxLength,
    nameMaxLength: PRODUCT_NAME_LIMITS.maxLength,
    unitPriceMin: UNIT_PRICE_LIMITS.min,
    unitPriceMax: UNIT_PRICE_LIMITS.max,
  });
  expect(CATALOG_INPUT_LIMITS.textMinLength).toBe(PRODUCT_NAME_LIMITS.minLength);
  expect(ORDER_INPUT_LIMITS).toEqual({
    quantityMin: ORDER_QUANTITY_LIMITS.min,
    quantityMax: ORDER_QUANTITY_LIMITS.max,
    lineCountMin: ORDER_LINE_LIMITS.minCount,
    lineCountMax: ORDER_LINE_LIMITS.maxCount,
  });
  expect(ROUTE_PARAM_LIMITS.organizationIdMaxLength).toBe(ACCESS_LIMITS.idMaxLength);
  expect(ACCESS_FORM_LIMITS.nameMaxLength).toBe(ACCESS_LIMITS.nameMaxLength);
  expect(ACCESS_FORM_LIMITS.emailMaxLength).toBe(ACCESS_LIMITS.emailMaxLength);
  expect(PRODUCT_IMAGE_LIMITS.maxCount).toBe(PRODUCT_IMAGE_MAX_COUNT);
  expect(PRODUCT_IMAGE_LIMITS.maxSizeBytes).toBe(MAX_IMAGE_BYTES);
});

it("企業IP制限の入力件数上限は画面とサーバーで一致する", () => {
  expect(BUSINESS_IP_FORM_MAX_ENTRIES).toBe(BUSINESS_IP_MAX_ENTRIES);
});

it("一覧の初期件数を揃え、上限超過・負値を拒否する", () => {
  expect(LIST_PAGE_SIZE).toBe(PAGE_LIMITS.defaultSize);
  expect(paginationSchema.parse({})).toEqual({ limit: LIST_PAGE_SIZE });
  for (const value of [
    { limit: 101 },
    { limit: 0 },
    { offset: 1 },
    { cursor: { id: "a" } },
    { cursor: { id: "", createdAt: "2026-10-10" } },
  ]) {
    expect(paginationSchema.safeParse(value).success).toBe(false);
  }
});

it("検索とプランコードの上限をAPIと画面で揃える", () => {
  expect(LIST_SEARCH_LIMITS.textLength).toBe(LIST_FILTER_LIMITS.searchLength);
  expect(LIST_SEARCH_LIMITS.planCodeLength).toBe(LIST_FILTER_LIMITS.planCodeLength);
});

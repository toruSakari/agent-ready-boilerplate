// 入力補助の制約をスキーマ・HTML属性・文言で共有する。サーバードメインの実装は取り込まない。
// APIの制約との一致は契約テストで確認し、クライアント検証だけで業務入力を信用しない。
export const CATALOG_INPUT_LIMITS = Object.freeze({
  textMinLength: 1,
  skuMaxLength: 64,
  nameMaxLength: 120,
  unitPriceMin: 0,
  unitPriceMax: 10_000_000,
});
export const ORDER_INPUT_LIMITS = Object.freeze({
  quantityMin: 1,
  quantityMax: 100,
  lineCountMin: 1,
  lineCountMax: 20,
});
export const INTEGER_INPUT_STEP = 1;

export const LIST_SEARCH_LIMITS = Object.freeze({ textLength: 100, planCodeLength: 200 });

// 開発用ストアの試用商品。業務データと区別できる固定ID・SKUを使う。
const CATALOG_CREATED_AT = "2026-10-01T00:00:00.000Z";
const INITIAL_DEMO_STOCK = 50;
export const DEVELOPMENT_CATALOG = [
  {
    id: "demo-product-mug",
    tenantId: "demo-store",
    sku: "demo-mug",
    name: "セラミックマグカップ",
    unitPrice: 1800,
  },
  {
    id: "demo-product-bottle",
    tenantId: "demo-store",
    sku: "demo-bottle",
    name: "ステンレスボトル",
    unitPrice: 2800,
  },
  {
    id: "demo-product-notebook",
    tenantId: "demo-store",
    sku: "demo-notebook",
    name: "クラフトノート",
    unitPrice: 680,
  },
  {
    id: "demo-product-tote",
    tenantId: "demo-second",
    sku: "demo-tote",
    name: "キャンバストートバッグ",
    unitPrice: 2200,
  },
  {
    id: "demo-product-light",
    tenantId: "demo-second",
    sku: "demo-light",
    name: "デスクライト",
    unitPrice: 4800,
  },
  {
    id: "demo-product-sample",
    tenantId: "demo-second",
    sku: "demo-sample",
    name: "無料お試しサンプル",
    unitPrice: 0,
  },
].map((product) => ({
  ...product,
  imageKey: null,
  createdAt: CATALOG_CREATED_AT,
  initialStock: INITIAL_DEMO_STOCK,
}));

export type DevelopmentCatalogProduct = (typeof DEVELOPMENT_CATALOG)[number];

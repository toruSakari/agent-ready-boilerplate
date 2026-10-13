import type { RouterInputs, RouterOutputs } from "@dev-template/api-types";

// 商品UIの契約はAPI入出力から導出し、サーバーのドメイン実装をフロントエンドへ持ち込まない。
export type Product = RouterOutputs["product"]["list"][number];

export type ProductImageEntry = Product["images"][number];

export type CreateProductInput = RouterInputs["product"]["create"];

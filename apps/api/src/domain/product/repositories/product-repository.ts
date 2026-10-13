import type { PageRequest } from "#api/domain/shared/page-request.ts";
import type { InventoryFilters, StoreFilters } from "#api/domain/shared/list-filters.ts";
import type { Product } from "#api/domain/product/entities/product.ts";

import type { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";

export type ProductImageWriteCondition = Readonly<{
  /** 読取時の代表画像キー。保存する画像の値とは分けて競合を判定する。 */
  expectedKey: string | null;
  now: string;
  deleteAfter: string;
}>;

export interface ProductRepository {
  /** 新商品・初期在庫・初期履歴を原子保存する。既存SKUの在庫変更には使わない。 */
  register(product: Product, initialStock: StockQuantity, actorId: string): Promise<void>;
  /** 次ページ判定のためlimit+1件を返す。画像は各商品に復元する。 */
  listPublic(page: PageRequest, search?: string, filters?: StoreFilters): Promise<Product[]>;
  findBySkus(tenantId: string, skus: readonly string[]): Promise<Product[]>;
  list(tenantId: string, page?: PageRequest, filters?: InventoryFilters): Promise<Product[]>;
  /** 基本情報だけを比較更新し、画像の並行更新を上書きしない。 */
  updateDetails(product: Product, expected: { name: string; unitPrice: number }): Promise<boolean>;
  /** 変更後のEntityから指定画像と代表参照だけを保存し、並行追加を上書きしない。 */
  attachImage(
    product: Product,
    imageId: string,
    condition: ProductImageWriteCondition,
  ): Promise<boolean>;
  /** Entityで解除した画像と次の代表参照を原子保存し、実体は保持期限後の清掃へ委ねる。 */
  removeImage(
    product: Product,
    imageId: string,
    condition: ProductImageWriteCondition,
  ): Promise<boolean>;
  find(tenantId: string, id: string): Promise<Product | null>;
}

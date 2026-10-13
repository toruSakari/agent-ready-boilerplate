import type { ProductImageEntry } from "#business/entities/product/index.ts";

export type ProductImageEditorProps = {
  productId: string;
  imageKey: string | null;
  images: readonly ProductImageEntry[];
  name: string;
  /** API更新後に商品一覧を再取得する。失敗時の部分保存も反映し、解決まで次の操作を待たせる。 */
  onChanged: () => Promise<void>;
};

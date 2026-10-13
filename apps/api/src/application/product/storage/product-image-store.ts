import type { ProductImageSnapshot } from "#api/domain/product/entities/product.ts";

export type StageProductImageInput = Readonly<{
  tenantId: string;
  productId: string;
  image: ProductImageSnapshot;
  deleteAfter: string;
}>;

/** アップロード前の回収記録だけを持ち、Productの有効な画像参照は変更しない。 */
export interface ProductImageStore {
  /** R2への書込み開始前に、一度限りのキーを回収可能な状態で登録する。 */
  stageImage(input: StageProductImageInput): Promise<void>;
}

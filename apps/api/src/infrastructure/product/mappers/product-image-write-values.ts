import type { Product } from "#api/domain/product/entities/product.ts";
import type { ProductImageWriteCondition } from "#api/domain/product/repositories/product-repository.ts";
import type { ProductImageAttachment } from "#api/infrastructure/product/shared/product-image-attachment.ts";

/** 指定画像だけをEntityから取り出し、代表画像との差し替え関係が一致する保存差分にする。 */
export function productImageAttachmentValues(
  product: Product,
  imageId: string,
  condition: ProductImageWriteCondition,
): ProductImageAttachment | null {
  const image = product.images.find((value) => value.id === imageId);
  if (!image || (product.imageKey !== image.key && product.imageKey !== condition.expectedKey)) {
    return null;
  }

  const replace = product.imageKey === image.key;
  if (
    replace &&
    condition.expectedKey !== image.key &&
    product.images.some((value) => value.key === condition.expectedKey)
  ) {
    return null;
  }

  return {
    ...condition,
    tenantId: product.tenantId,
    productId: product.id,
    image,
    imageKey: product.imageKey,
    replace,
  };
}

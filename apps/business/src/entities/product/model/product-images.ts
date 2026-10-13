import type { ProductImageEntry } from "#business/entities/product/model/product.ts";

export function productImages(images: readonly ProductImageEntry[], imageKey: string | null) {
  return {
    primaryImage: images.find((image) => image.key === imageKey),
    additionalImages: images.filter((image) => image.key !== imageKey),
  };
}

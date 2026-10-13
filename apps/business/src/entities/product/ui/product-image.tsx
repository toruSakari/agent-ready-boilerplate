"use client";
import { t as translate } from "@dev-template/client/i18n";
import { useProductImage } from "#business/entities/product/api/product-image.ts";
import type { Product, ProductImageEntry } from "#business/entities/product/model/product.ts";
import { BlobImage } from "#business/entities/product/ui/blob-image.tsx";

export function ProductImage(props: {
  product: Pick<Product, "id" | "imageKey" | "name">;
  image?: ProductImageEntry;
  alt?: string;
}) {
  const {
    product,
    image: entry,
    alt = translate("{{name}}の商品画像", { name: product.name }),
  } = props;

  const image = useProductImage(product, entry);
  const imageKey = entry?.key ?? product.imageKey;
  let imageStatus;
  if (!imageKey) {
    imageStatus = translate("画像未登録");
  } else {
    if (image.isError) {
      imageStatus = translate("画像を取得できませんでした");
    } else {
      imageStatus = translate("画像を読み込み中…");
    }
  }

  return (
    <div className="flex h-40 items-center justify-center overflow-hidden rounded-xl bg-muted">
      {imageKey && image.data ? (
        <BlobImage blob={image.data} alt={alt} />
      ) : (
        <span className="text-sm text-muted-foreground">{imageStatus}</span>
      )}
    </div>
  );
}

export { BlobImage } from "#business/entities/product/ui/blob-image.tsx";

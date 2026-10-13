"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPCClient } from "@dev-template/client/api";
import type { Product, ProductImageEntry } from "#business/entities/product/model/product.ts";

/** 画像指定がなければメイン画像、指定時はその画像を認証付きAPIから取得する。 */
export function useProductImage(
  product: Pick<Product, "id" | "imageKey">,
  image?: ProductImageEntry,
) {
  const trpc = useTRPCClient();
  return useQuery({
    // 代表画像の取得は商品IDが同じでもキーが変わるため、差し替え前のBlobを再利用しない。
    queryKey: ["product-image", product.id, image?.id ?? null, image?.key ?? product.imageKey],
    enabled: Boolean(image?.key ?? product.imageKey),
    staleTime: Infinity,
    retry: false,
    // 画像は代替表示で続行できるため、画面全体を取り下げない。
    throwOnError: false,
    // Queryの中断をtRPCまで渡し、画像切替後に不要となった取得を継続させない。
    queryFn: async (props) => {
      const imageData = await trpc.product.getImage.query(
        { service: "business", id: product.id, ...(image ? { imageId: image.id } : {}) },
        { signal: props.signal },
      );
      const bytes = Uint8Array.from(atob(imageData.base64), (character) => character.charCodeAt(0));
      return new Blob([bytes], { type: imageData.contentType });
    },
  });
}

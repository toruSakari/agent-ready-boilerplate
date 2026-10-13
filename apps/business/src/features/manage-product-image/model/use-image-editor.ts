import { useRef, useState } from "react";
import { errorMessage } from "@dev-template/client/i18n";
import { useChangeProductImages } from "#business/features/manage-product-image/api/use-change-product-images.ts";
import { imageChangeValidationError } from "#business/features/manage-product-image/model/image-change.ts";
import type { ImageChange } from "#business/features/manage-product-image/model/image-change.ts";
import type { ProductImageEditorProps } from "#business/features/manage-product-image/model/editor-props.ts";

export function useImageEditor(props: ProductImageEditorProps) {
  const changing = useRef(false);
  const change = useChangeProductImages(props.productId, props.onChanged);
  const [error, setError] = useState<string | null>(null);

  async function changeImage(action: ImageChange) {
    // isPendingの再描画前に続けてイベントが来ても、同じ編集欄から二重送信しない。
    if (changing.current) {
      return;
    }

    const validationError = imageChangeValidationError(action, props.images.length);
    if (validationError) {
      setError(validationError);
      return;
    }

    changing.current = true;
    setError(null);
    try {
      await change.mutateAsync(action);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      changing.current = false;
    }
  }

  return { error, pending: change.isPending, changeImage };
}

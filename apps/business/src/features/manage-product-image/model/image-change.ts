import { t as translate } from "@dev-template/client/i18n";
import { PRODUCT_IMAGE_LIMITS } from "#business/entities/product/index.ts";

export type ImageChange =
  | { kind: "replace"; file: File }
  | { kind: "append"; files: readonly File[] }
  | { kind: "remove"; imageId: string };

/** 全ファイルを送信前に確認し、不正な1枚が混じるだけで先行画像が保存されることを避ける。 */
export function imageChangeValidationError(action: ImageChange, imageCount: number): string | null {
  let files;
  if (action.kind === "append") {
    files = action.files;
  } else {
    if (action.kind === "replace") {
      files = [action.file];
    } else {
      files = [];
    }
  }

  if (
    files.some(
      (file) =>
        !PRODUCT_IMAGE_LIMITS.mimeTypes.includes(file.type) ||
        file.size > PRODUCT_IMAGE_LIMITS.maxSizeBytes,
    )
  ) {
    return translate("{{max}}MB以下のPNG・JPEG・WebP画像を選んでください", {
      max: PRODUCT_IMAGE_LIMITS.maxSizeMebibytes,
    });
  }

  if (action.kind === "append" && imageCount + files.length > PRODUCT_IMAGE_LIMITS.maxCount) {
    return translate("商品画像は{{max}}枚までです", { max: PRODUCT_IMAGE_LIMITS.maxCount });
  }

  return null;
}

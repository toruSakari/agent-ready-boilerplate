const BYTES_PER_MEBIBYTE = 1_048_576;
const MAX_IMAGE_MEBIBYTES = 5;
// 画像選択の検証・accept属性・容量文言の正本。API側の検証は別の信頼境界として残す。
export const PRODUCT_IMAGE_LIMITS = Object.freeze({
  maxCount: 20,
  maxSizeMebibytes: MAX_IMAGE_MEBIBYTES,
  maxSizeBytes: MAX_IMAGE_MEBIBYTES * BYTES_PER_MEBIBYTE,
  mimeTypes: Object.freeze(["image/png", "image/jpeg", "image/webp"]),
});

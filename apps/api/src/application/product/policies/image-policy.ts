export const IMAGE_CONTENT_TYPES = Object.freeze({
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
} as const);

export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[keyof typeof IMAGE_CONTENT_TYPES];

export function isImageContentType(value: string): value is ImageContentType {
  return Object.values(IMAGE_CONTENT_TYPES).some((contentType) => contentType === value);
}

const BYTES_PER_MEBIBYTE = 1_048_576;
export const MAX_IMAGE_MEBIBYTES = 5;
export const MAX_IMAGE_BYTES = MAX_IMAGE_MEBIBYTES * BYTES_PER_MEBIBYTE;
// 最短保持期間。参照中・清掃停止・再試行待ちの画像はこの期間を過ぎても残る。
export const IMAGE_RETENTION_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
export const IMAGE_RETENTION_MS = IMAGE_RETENTION_DAYS * MILLISECONDS_PER_DAY;
export const IMAGE_CLEANUP_BATCH_SIZE = 50;
// 清掃途中の停止から再試行できるよう、削除対象の確保を期限付きにする。
export const IMAGE_CLEANUP_LEASE_MS = 5 * 60 * 1000;

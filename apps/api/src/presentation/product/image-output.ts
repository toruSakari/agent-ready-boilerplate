import { TRPCError } from "@trpc/server";
import {
  isImageContentType,
  MAX_IMAGE_BYTES,
} from "#api/application/product/policies/image-policy.ts";
import type { StoredImage } from "#api/application/product/storage/product-image-storage.ts";

const BASE64_CHUNK_BYTES = 3 * 8192;

/** JSON応答用に認可済みの画像を有界で読む。R2のURL・任意キーは公開しない。 */
export async function imageOutput(image: StoredImage, signal: AbortSignal) {
  const reader = image.body.getReader();
  const abort = () => {
    void reader.cancel(signal.reason).catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (signal.aborted) {
      await reader.cancel(signal.reason).catch(() => {});
      signal.throwIfAborted();
    }

    if (!isImageContentType(image.contentType)) {
      await reader.cancel().catch(() => {});
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    }

    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const result = await reader.read();
      signal.throwIfAborted();
      if (result.done) {
        break;
      }

      size += result.value.byteLength;
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel().catch(() => {});
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      chunks.push(result.value);
    }

    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    // 3の倍数で分割し、巨大な引数展開と途中のbase64パディングを避ける。
    // 通信量は最大5MiBの4/3倍になるため、このqueryは単独実行に限定する。
    const encoded: string[] = [];
    for (let start = 0; start < bytes.length; start += BASE64_CHUNK_BYTES) {
      encoded.push(btoa(String.fromCharCode(...bytes.subarray(start, start + BASE64_CHUNK_BYTES))));
    }

    return { base64: encoded.join(""), contentType: image.contentType, etag: image.etag };
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

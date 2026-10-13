import type { ProductImageStorage } from "#api/application/product/storage/product-image-storage.ts";

export class R2ProductImageStorage implements ProductImageStorage {
  constructor(private readonly bucket: R2Bucket) {}

  async put(key: string, bytes: ArrayBuffer, contentType: string) {
    // D1での確保に加えてR2でも既存オブジェクトの上書きを拒否し、キーを一度だけ使う。
    const stored = await this.bucket.put(key, bytes, {
      httpMetadata: { contentType },
      onlyIf: { etagDoesNotMatch: "*" },
    });
    if (stored === null) {
      throw new Error("商品画像の保存キーは再利用できません");
    }
  }

  async get(key: string) {
    const object = await this.bucket.get(key);
    return object
      ? {
          body: object.body,
          contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
          etag: object.httpEtag,
        }
      : null;
  }

  async delete(key: string) {
    await this.bucket.delete(key);
  }
}

export type StoredImage = { body: ReadableStream; contentType: string; etag: string };

/** 画像実体だけを扱う。商品への関連付け・参照検査・保持期限はRepositoryと清掃処理が担う。 */
export interface ProductImageStorage {
  put(key: string, bytes: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredImage | null>;
  delete(key: string): Promise<void>;
}

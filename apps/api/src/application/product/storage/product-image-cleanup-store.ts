export type ClaimProductImageGarbageInput = Readonly<{
  now: string;
  limit: number;
  leaseUntil: string;
  claimToken: string;
}>;

export type ProductImageGarbage = Readonly<{ imageId: string; key: string }>;

export interface ProductImageCleanupStore {
  /** 保持期限切れで未参照のキーだけを確保し、削除中のキーの再関連付けを禁止する。 */
  claimImageGarbage(input: ClaimProductImageGarbageInput): Promise<readonly ProductImageGarbage[]>;
  /** キー再利用を防ぐ削除記録を残す。古い確保トークンでは新しい確保を完了できない。 */
  completeImageGarbage(input: { imageId: string; claimToken: string }): Promise<void>;
}

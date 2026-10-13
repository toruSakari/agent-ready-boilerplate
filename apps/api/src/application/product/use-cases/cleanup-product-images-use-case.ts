import { CleanupProductImagesOutputDto } from "#api/application/product/dtos/cleanup-product-images-output-dto.ts";
import type { CleanupProductImagesInputDto } from "#api/application/product/dtos/cleanup-product-images-input-dto.ts";
import {
  IMAGE_CLEANUP_BATCH_SIZE,
  IMAGE_CLEANUP_LEASE_MS,
} from "#api/application/product/policies/image-policy.ts";
import type { ProductImageCleanupStore } from "#api/application/product/storage/product-image-cleanup-store.ts";
import type { ProductImageStorage } from "#api/application/product/storage/product-image-storage.ts";

export class CleanupProductImagesUseCase {
  constructor(
    private readonly store: ProductImageCleanupStore,
    private readonly images: ProductImageStorage,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(_inputDto: CleanupProductImagesInputDto): Promise<CleanupProductImagesOutputDto> {
    const now = this.clock();
    const claimToken = crypto.randomUUID();
    const candidates = await this.store.claimImageGarbage({
      now: now.toISOString(),
      limit: IMAGE_CLEANUP_BATCH_SIZE,
      leaseUntil: new Date(now.getTime() + IMAGE_CLEANUP_LEASE_MS).toISOString(),
      claimToken,
    });
    let deleted = 0;
    let failed = 0;
    for (const image of candidates) {
      try {
        // 永続化した削除中状態が再関連付けを防ぐ。実体削除と完了記録のどちらで失敗しても、
        // リース期限後に再確保して同じ削除を安全に再試行できる。
        await this.images.delete(image.key);
        await this.store.completeImageGarbage({ imageId: image.imageId, claimToken });
        deleted += 1;
      } catch {
        // 完了済みにはせず次回の再確保へ残し、同じバッチの残りの画像は処理を続ける。
        failed += 1;
      }
    }

    return CleanupProductImagesOutputDto.parse({ deleted, failed });
  }
}

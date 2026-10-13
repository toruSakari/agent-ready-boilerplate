import { CleanupProductImagesInputDto } from "#api/application/product/dtos/cleanup-product-images-input-dto.ts";
import { expect, it, vi } from "vite-plus/test";
import { CleanupProductImagesUseCase } from "#api/application/product/use-cases/cleanup-product-images-use-case.ts";
import {
  IMAGE_CLEANUP_BATCH_SIZE,
  IMAGE_CLEANUP_LEASE_MS,
} from "#api/application/product/policies/image-policy.ts";
import type { ProductImageCleanupStore } from "#api/application/product/storage/product-image-cleanup-store.ts";
import type { ProductImageStorage } from "#api/application/product/storage/product-image-storage.ts";

const NOW = new Date("2026-10-12T00:00:00.000Z");

function setup() {
  const store = {
    claimImageGarbage: vi.fn<ProductImageCleanupStore["claimImageGarbage"]>().mockResolvedValue([
      { imageId: "i1", key: "k1" },
      { imageId: "i2", key: "k2" },
    ]),
    completeImageGarbage: vi
      .fn<ProductImageCleanupStore["completeImageGarbage"]>()
      .mockResolvedValue(undefined),
  };
  const images = {
    put: vi.fn<ProductImageStorage["put"]>(),
    get: vi.fn<ProductImageStorage["get"]>(),
    delete: vi.fn<ProductImageStorage["delete"]>().mockResolvedValue(undefined),
  };
  return { store, images, cleanup: new CleanupProductImagesUseCase(store, images, () => NOW) };
}

it("削除前に上限件数までの対象を確保し、成功した削除ごとに完了を記録する", async () => {
  const { store, images, cleanup } = setup();
  expect(await cleanup.execute(CleanupProductImagesInputDto.parse({}))).toEqual({
    deleted: 2,
    failed: 0,
  });
  expect(store.claimImageGarbage).toHaveBeenCalledWith({
    now: NOW.toISOString(),
    limit: IMAGE_CLEANUP_BATCH_SIZE,
    leaseUntil: new Date(NOW.getTime() + IMAGE_CLEANUP_LEASE_MS).toISOString(),
    claimToken: expect.any(String),
  });
  expect(store.claimImageGarbage.mock.invocationCallOrder[0]).toBeLessThan(
    images.delete.mock.invocationCallOrder[0]!,
  );
  expect(images.delete.mock.invocationCallOrder[0]).toBeLessThan(
    store.completeImageGarbage.mock.invocationCallOrder[0]!,
  );
  expect(store.completeImageGarbage).toHaveBeenCalledWith({
    imageId: "i1",
    claimToken: store.claimImageGarbage.mock.calls[0]![0].claimToken,
  });
});
it("DBの参照確認に失敗した場合は削除しない", async () => {
  const { store, images, cleanup } = setup();
  store.claimImageGarbage.mockRejectedValue(new Error("D1 unavailable"));
  await expect(cleanup.execute(CleanupProductImagesInputDto.parse({}))).rejects.toThrow(
    "D1 unavailable",
  );
  expect(images.delete).not.toHaveBeenCalled();
});
it("削除に失敗した対象は再試行できるよう未完了のまま残し、バッチの残りを処理する", async () => {
  const { store, images, cleanup } = setup();
  images.delete.mockRejectedValueOnce(new Error("R2 unavailable"));
  expect(await cleanup.execute(CleanupProductImagesInputDto.parse({}))).toEqual({
    deleted: 1,
    failed: 1,
  });
  expect(store.completeImageGarbage).toHaveBeenCalledTimes(1);
  expect(store.completeImageGarbage).toHaveBeenCalledWith(
    expect.objectContaining({ imageId: "i2" }),
  );
});
it("R2で削除済みでも完了記録の応答が失われた場合は安全に再試行できる", async () => {
  const { store, images, cleanup } = setup();
  store.claimImageGarbage.mockResolvedValue([{ imageId: "i1", key: "k1" }]);
  store.completeImageGarbage.mockRejectedValueOnce(new Error("D1 response lost"));
  // 再実行時の再確保はストアのモックで再現し、実際のリース期限判定はストア側の検証に任せる。
  expect(await cleanup.execute(CleanupProductImagesInputDto.parse({}))).toEqual({
    deleted: 0,
    failed: 1,
  });
  expect(await cleanup.execute(CleanupProductImagesInputDto.parse({}))).toEqual({
    deleted: 1,
    failed: 0,
  });
  expect(images.delete.mock.calls).toEqual([["k1"], ["k1"]]);
});

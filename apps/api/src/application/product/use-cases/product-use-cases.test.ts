import { Product } from "#api/domain/product/entities/product.ts";
import { ProductAddImageInputDto } from "#api/application/product/dtos/product-add-image-input-dto.ts";
import { ProductUploadImageInputDto } from "#api/application/product/dtos/product-upload-image-input-dto.ts";
import { ProductGetImageInputDto } from "#api/application/product/dtos/product-get-image-input-dto.ts";
import { ProductDeleteImageInputDto } from "#api/application/product/dtos/product-delete-image-input-dto.ts";
import { ProductGetInputDto } from "#api/application/product/dtos/product-get-input-dto.ts";
import { ProductUpdateInputDto } from "#api/application/product/dtos/product-update-input-dto.ts";
import { CreateProductInputDto } from "#api/application/product/dtos/create-product-input-dto.ts";
import type { ProductImageStore } from "#api/application/product/storage/product-image-store.ts";
import { CreateProductUseCase } from "#api/application/product/use-cases/create-product-use-case.ts";
import { authorizedActor } from "#api/test/authorized-actor.ts";
import { BUSINESS_PERMISSIONS } from "#api/domain/access/policies/permission-catalog.ts";
import {
  IMAGE_RETENTION_MS,
  MAX_IMAGE_BYTES,
} from "#api/application/product/policies/image-policy.ts";
import { productValues } from "#api/test/domain-values.ts";
import { expect, it, vi } from "vite-plus/test";
import { ProductUseCases } from "#api/application/product/use-cases/product-use-cases.ts";

import type { ProductRepository } from "#api/domain/product/repositories/product-repository.ts";
import type { ProductImageStorage } from "#api/application/product/storage/product-image-storage.ts";

const admin = {
  userId: "user-1",
  tenantId: "store-1",
  role: "admin" as const,
  permissions: BUSINESS_PERMISSIONS,
};
const NOW = new Date("2026-10-04T00:00:00.000Z");
// シグネチャ検査に必要な最小バイト列。完全な画像のデコード成功を検証するfixtureではない。
const png = () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer;

function setup(imageKey: string | null = "old-image") {
  const state = { product: fixtureProduct(imageKey) };
  const products = {
    register: vi.fn<ProductRepository["register"]>(),
    attachImage: vi.fn<ProductRepository["attachImage"]>(async (next, _imageId, condition) => {
      if (condition.expectedKey !== state.product.imageKey) {
        return false;
      }

      state.product = next;
      return true;
    }),
    removeImage: vi.fn<ProductRepository["removeImage"]>(async (next, _imageId, condition) => {
      if (condition.expectedKey !== state.product.imageKey) {
        return false;
      }

      state.product = next;
      return true;
    }),
    findBySkus: vi.fn<ProductRepository["findBySkus"]>(async () => [state.product]),
    list: vi.fn<ProductRepository["list"]>(async () => [state.product]),
    updateDetails: vi.fn<ProductRepository["updateDetails"]>(async (next, expected) => {
      if (expected.name !== state.product.name || expected.unitPrice !== state.product.unitPrice) {
        return false;
      }

      state.product = next;
      return true;
    }),
    find: vi.fn<ProductRepository["find"]>(async (tenantId, id) =>
      tenantId === state.product.tenantId && id === state.product.id ? state.product : null,
    ),
    listPublic: vi.fn<ProductRepository["listPublic"]>(),
  } satisfies ProductRepository;
  const imageStore = { stageImage: vi.fn<ProductImageStore["stageImage"]>() };
  const images = fixtureImageStorage();
  return {
    products,
    imageStore,
    images,
    useCases: new ProductUseCases(products, images, imageStore, () => NOW),
    current: () => state.product,
  };
}

it("商品画像の管理 / アップロード前に復旧用の情報を登録し、画像を即時削除せずに参照を切り替える", async () => {
  const { useCases, products, imageStore, images, current } = setup();
  await useCases.uploadImage(
    ProductUploadImageInputDto.parse({
      identity: await authorizedActor(admin),
      id: "product-1",
      bytes: png(),
      contentType: "image/png",
    }),
  );
  expect(current().imageKey).toMatch(/^products\/store-1\/product-1\//);
  expect(images.put).toHaveBeenCalledWith(current().imageKey, png(), "image/png");
  expect(imageStore.stageImage.mock.invocationCallOrder[0]).toBeLessThan(
    images.put.mock.invocationCallOrder[0]!,
  );
  expect(images.put.mock.invocationCallOrder[0]).toBeLessThan(
    products.attachImage.mock.invocationCallOrder[0]!,
  );
  expect(products.attachImage).toHaveBeenCalledWith(
    expect.any(Product),
    current().images[0]!.id,
    expect.objectContaining({
      expectedKey: "old-image",
      now: NOW.toISOString(),
      deleteAfter: new Date(NOW.getTime() + IMAGE_RETENTION_MS).toISOString(),
    }),
  );
  expect(current().images).toHaveLength(1);
  expect(images.delete).not.toHaveBeenCalled();
});
it("商品画像の管理 / 代表画像を維持したまま複数の画像を追加する", async () => {
  const { useCases, current } = setup();
  await useCases.addImage(
    ProductAddImageInputDto.parse({
      identity: await authorizedActor(admin),
      id: "product-1",
      bytes: png(),
      contentType: "image/png",
    }),
  );
  await useCases.addImage(
    ProductAddImageInputDto.parse({
      identity: await authorizedActor(admin),
      id: "product-1",
      bytes: png(),
      contentType: "image/png",
    }),
  );
  expect(current().images).toHaveLength(3);
  expect(new Set(current().images.map((image) => image.key)).size).toBe(3);
  expect(current().imageKey).toBe("old-image");
});
it("商品画像の管理 / 復旧用の情報の登録に失敗した場合はアップロードしない", async () => {
  const { useCases, imageStore, images } = setup();
  imageStore.stageImage.mockRejectedValue(new Error("D1 unavailable"));
  await expect(
    useCases.addImage(
      ProductAddImageInputDto.parse({
        identity: await authorizedActor(admin),
        id: "product-1",
        bytes: png(),
        contentType: "image/png",
      }),
    ),
  ).rejects.toThrow("D1 unavailable");
  expect(images.put).not.toHaveBeenCalled();
});
it("商品画像の管理 / R2への保存に失敗しても復旧用の情報を残し、安全に再試行できる遅延削除に委ねる", async () => {
  const { useCases, products, imageStore, images, current } = setup();
  images.put.mockRejectedValue(new Error("R2 unavailable"));
  await expect(
    useCases.uploadImage(
      ProductUploadImageInputDto.parse({
        identity: await authorizedActor(admin),
        id: "product-1",
        bytes: png(),
        contentType: "image/png",
      }),
    ),
  ).rejects.toThrow("R2 unavailable");
  expect(imageStore.stageImage).toHaveBeenCalled();
  expect(products.attachImage).not.toHaveBeenCalled();
  expect(current().imageKey).toBe("old-image");
  expect(images.delete).not.toHaveBeenCalled();
});
it("商品画像の管理 / D1への保存結果が不明な場合は新しいオブジェクトを削除しない", async () => {
  const { useCases, products, images, current } = setup();
  const commit = products.attachImage.getMockImplementation()!;
  products.attachImage.mockImplementation(async (...args) => {
    await commit(...args);
    throw new Error("D1 response lost after commit");
  });
  await expect(
    useCases.uploadImage(
      ProductUploadImageInputDto.parse({
        identity: await authorizedActor(admin),
        id: "product-1",
        bytes: png(),
        contentType: "image/png",
      }),
    ),
  ).rejects.toThrow("D1 response lost after commit");
  expect(current().imageKey).not.toBe("old-image");
  expect(images.delete).not.toHaveBeenCalled();
});
it("商品画像の管理 / 同時差し替えの競合を検出し、参照を確認して削除できるよう両方のオブジェクトを残す", async () => {
  const { useCases, products, images } = setup();
  products.attachImage.mockResolvedValue(false);
  await expect(
    useCases.uploadImage(
      ProductUploadImageInputDto.parse({
        identity: await authorizedActor(admin),
        id: "product-1",
        bytes: png(),
        contentType: "image/png",
      }),
    ),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(images.delete).not.toHaveBeenCalled();
});
it("商品画像の管理 / 更新権限不足を認可境界で、テナントをまたぐアクセスを業務側で拒否する", async () => {
  const { useCases, images, imageStore } = setup();
  await assertProductMutationDenied(useCases);
  await expect(
    useCases.getImage(
      ProductGetImageInputDto.parse({
        identity: await authorizedActor({ ...admin, tenantId: "other-store" }),
        id: "product-1",
        imageId: "old-id",
      }),
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    useCases.uploadImage(
      ProductUploadImageInputDto.parse({
        identity: await authorizedActor({ ...admin, tenantId: "other-store" }),
        id: "product-1",
        bytes: png(),
        contentType: "image/png",
      }),
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(images.put).not.toHaveBeenCalled();
  expect(imageStore.stageImage).not.toHaveBeenCalled();
});
it.each([
  [new ArrayBuffer(0), "image/png"],
  [new Uint8Array([1, 2, 3]).buffer, "image/png"],
  [png(), "image/jpeg"],
  [png(), "image/svg+xml"],
  [new ArrayBuffer(MAX_IMAGE_BYTES + 1), "image/png"],
])("商品画像の管理 / 不正な画像やサイズ上限を超える画像を拒否する", async (bytes, contentType) => {
  const { useCases, images, imageStore } = setup();
  await expect(
    useCases.uploadImage(
      ProductUploadImageInputDto.parse({
        identity: await authorizedActor(admin),
        id: "product-1",
        bytes,
        contentType,
      }),
    ),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(images.put).not.toHaveBeenCalled();
  expect(imageStore.stageImage).not.toHaveBeenCalled();
});
it.each([
  [new Uint8Array([255, 216, 255]).buffer, "image/jpeg"],
  [new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]).buffer, "image/webp"],
])(
  "商品画像の管理 / ほかの対応形式もファイルシグネチャが一致する場合だけ受け入れる",
  async (bytes, contentType) => {
    const { useCases, images, imageStore } = setup();
    await useCases.uploadImage(
      ProductUploadImageInputDto.parse({
        identity: await authorizedActor(admin),
        id: "product-1",
        bytes,
        contentType,
      }),
    );
    expect(imageStore.stageImage).toHaveBeenCalledOnce();
    expect(images.put).toHaveBeenCalledWith(expect.any(String), bytes, contentType);
  },
);
it("商品画像の管理 / 指定した画像だけを削除して代表画像を繰り上げ、同じ削除の再実行を許容する", async () => {
  const { useCases, images, products, current } = setup();
  const added = await useCases.addImage(
    ProductAddImageInputDto.parse({
      identity: await authorizedActor(admin),
      id: "product-1",
      bytes: png(),
      contentType: "image/png",
    }),
  );
  await useCases.deleteImage(
    ProductDeleteImageInputDto.parse({
      identity: await authorizedActor(admin),
      id: "product-1",
      imageId: "old-id",
    }),
  );
  await useCases.deleteImage(
    ProductDeleteImageInputDto.parse({
      identity: await authorizedActor(admin),
      id: "product-1",
      imageId: "old-id",
    }),
  );
  expect(current().imageKey).toBe(added.key);
  expect(current().images).toHaveLength(1);
  expect(products.removeImage).toHaveBeenCalledTimes(1);
  expect(products.removeImage).toHaveBeenCalledWith(
    expect.any(Product),
    "old-id",
    expect.objectContaining({
      expectedKey: "old-image",
      deleteAfter: new Date(NOW.getTime() + IMAGE_RETENTION_MS).toISOString(),
    }),
  );
  expect(images.delete).not.toHaveBeenCalled();
});
it("商品画像の管理 / 認可された商品に属する有効な画像だけを取得する", async () => {
  const { useCases, images } = setup();
  const stored = { body: new ReadableStream(), contentType: "image/png", etag: "etag" };
  images.get.mockResolvedValue(stored);
  const result = await useCases.getImage(
    ProductGetImageInputDto.parse({
      identity: await authorizedActor(admin),
      id: "product-1",
      imageId: "old-id",
    }),
  );
  expect(result).toEqual(stored);
  expect(result.body).toBe(stored.body);
  expect(images.get).toHaveBeenCalledWith("old-image");
  images.get.mockClear();
  await expect(
    useCases.getImage(
      ProductGetImageInputDto.parse({
        identity: await authorizedActor(admin),
        id: "product-1",
        imageId: "other-image",
      }),
    ),
  ).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(images.get).not.toHaveBeenCalled();
});
it("商品基本情報 / 企業スコープで取得し、別企業の商品を公開しない", async () => {
  const { useCases } = setup();
  expect(
    (
      await useCases.get(
        ProductGetInputDto.parse({ identity: await authorizedActor(admin), id: "product-1" }),
      )
    ).unitPrice,
  ).toBe(2400);
  await expect(
    useCases.get(
      ProductGetInputDto.parse({
        identity: await authorizedActor({ ...admin, tenantId: "other" }),
        id: "product-1",
      }),
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("商品基本情報 / 無料価格へ更新し、SKUと画像を保持する", async () => {
  const { useCases, current } = setup();
  await useCases.update(
    ProductUpdateInputDto.parse({
      identity: await authorizedActor(admin),
      input: {
        id: "product-1",
        name: "Free mug",
        unitPrice: 0,
        expectedName: "Mug",
        expectedUnitPrice: 2400,
      },
    }),
  );
  expect(current()).toMatchObject({
    sku: "SKU-1",
    name: "Free mug",
    unitPrice: 0,
    imageKey: "old-image",
  });
});
it("商品基本情報 / 古い価格による上書きと負の価格を保存しない", async () => {
  const { useCases, products } = setup();
  const actor = await authorizedActor(admin);
  await expect(
    useCases.update(
      ProductUpdateInputDto.parse({
        identity: actor,
        input: {
          id: "product-1",
          name: "Mug",
          unitPrice: 0,
          expectedName: "Mug",
          expectedUnitPrice: 1,
        },
      }),
    ),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  products.updateDetails.mockClear();
  await expect(
    useCases.update(
      ProductUpdateInputDto.parse({
        identity: actor,
        input: {
          id: "product-1",
          name: "Mug",
          unitPrice: -1,
          expectedName: "Mug",
          expectedUnitPrice: 2400,
        },
      }),
    ),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(products.updateDetails).not.toHaveBeenCalled();
});

async function assertProductMutationDenied(useCases: ProductUseCases) {
  const member = {
    ...admin,
    role: "member" as const,
    permissions: ["order:read", "product.read"] as const,
  };
  await expect(async () =>
    useCases.uploadImage(
      ProductUploadImageInputDto.parse({
        identity: await authorizedActor(member, ["product.update"]),
        id: "product-1",
        bytes: png(),
        contentType: "image/png",
      }),
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(async () =>
    useCases.addImage(
      ProductAddImageInputDto.parse({
        identity: await authorizedActor(member, ["product.update"]),
        id: "product-1",
        bytes: png(),
        contentType: "image/png",
      }),
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    async () =>
      await useCases.deleteImage(
        ProductDeleteImageInputDto.parse({
          identity: await authorizedActor(member, ["product.update"]),
          id: "product-1",
          imageId: "old-id",
        }),
      ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(async () =>
    new CreateProductUseCase({ register: vi.fn() }).execute(
      CreateProductInputDto.parse({
        actor: await authorizedActor(member, ["product.update"]),
        input: {
          sku: "SKU",
          name: "Mug",
          unitPrice: 100,
        },
      }),
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
}

function fixtureProduct(imageKey: string | null): Product {
  return Product.restore(
    productValues({
      id: "product-1",
      tenantId: admin.tenantId,
      sku: "SKU-1",
      name: "Mug",
      unitPrice: 2400,
      imageKey,
      images: imageKey ? [{ id: "old-id", key: imageKey, createdAt: NOW.toISOString() }] : [],
      createdAt: NOW.toISOString(),
    }),
  );
}

function fixtureImageStorage() {
  const images = {
    put: vi.fn<ProductImageStorage["put"]>().mockResolvedValue(undefined),
    get: vi.fn<ProductImageStorage["get"]>().mockResolvedValue(null),
    delete: vi.fn<ProductImageStorage["delete"]>().mockResolvedValue(undefined),
  } satisfies ProductImageStorage;
  return images;
}

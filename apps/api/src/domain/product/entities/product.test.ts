import { Product, PRODUCT_IMAGE_MAX_COUNT } from "#api/domain/product/entities/product.ts";
import type {
  ProductImageSnapshot,
  ProductSnapshot,
} from "#api/domain/product/entities/product.ts";
import { productValues } from "#api/test/domain-values.ts";
import { InvalidProductError } from "#api/domain/product/errors/invalid-product-error.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { ProductName } from "#api/domain/shared/value-objects/product-name.ts";
import { UnitPrice } from "#api/domain/shared/value-objects/unit-price.ts";
import { describe, expect, it } from "vite-plus/test";

const NOW = "2026-10-04T00:00:00.000Z";
const product = Product.create({
  tenantId: "t1",
  sku: Sku.create("s1"),
  name: ProductName.create("マグ"),
  unitPrice: UnitPrice.create(500),
});

function image(id: string, createdAt = NOW): ProductImageSnapshot {
  return { id, key: `products/${id}`, createdAt };
}

function restoreProductFixture(value: ProductSnapshot) {
  return Product.restore(productValues(value));
}

function fullGallery() {
  return Array.from({ length: PRODUCT_IMAGE_MAX_COUNT }, (_, index) =>
    image(`image-${index}`),
  ).reduce((current, next) => current.addImage(next), product);
}

function expectUnchangedDetails(current: Product) {
  expect(current).toMatchObject({
    id: product.id,
    tenantId: product.tenantId,
    sku: product.sku,
    name: product.name,
    unitPrice: product.unitPrice,
    createdAt: product.createdAt,
  });
}

describe("Productの不変条件", () => {
  it("商品は状態遷移を持たず、作成・復元で同じ検証を行う", () => {
    expect(product).toBeInstanceOf(Product);
    expect(product.sku).toBe("s1");
    expect(restoreProductFixture(product.toSnapshot())).toEqual(product);
    expect(Object.isFrozen(product)).toBe(true);
  });
  it("代表画像は有効な画像一覧に含まれ、画像IDは重複しない", () => {
    const first = image("image-1");
    const value = { ...product.toSnapshot(), imageKey: first.key, images: [first] };
    const restored = restoreProductFixture(value);
    expect(restored).toBeInstanceOf(Product);
    expect(Object.isFrozen(restored.images)).toBe(true);
    expect(Object.isFrozen(restored.images[0])).toBe(true);
    expect(() => restoreProductFixture({ ...value, imageKey: "missing" })).toThrow();
    expect(() => restoreProductFixture({ ...value, imageKey: null })).toThrow();
    expect(() => restoreProductFixture({ ...value, images: [first, first] })).toThrow();
  });
  it("復元時も画像件数の上限と画像キーの重複を拒否する", () => {
    const full = fullGallery();
    expect(() =>
      restoreProductFixture({
        ...full.toSnapshot(),
        images: [...full.images, image("extra")],
      }),
    ).toThrow(InvalidProductError);
    expect(() =>
      restoreProductFixture({
        ...product.toSnapshot(),
        imageKey: image("same").key,
        images: [image("same"), { ...image("same"), id: "another" }],
      }),
    ).toThrow(InvalidProductError);
  });
});

it("20枚の画像を持つ商品もスナップショットから復元できる", () => {
  const full = fullGallery();
  const restored = restoreProductFixture(full.toSnapshot());
  expect(PRODUCT_IMAGE_MAX_COUNT).toBe(20);
  expect(restored.images).toHaveLength(20);
  expect(restored).toEqual(full);
});
it("異なる画像キーでも同じ画像IDを持つ保存データを拒否する", () => {
  const first = image("same-id");
  expect(() =>
    restoreProductFixture({
      ...product.toSnapshot(),
      imageKey: first.key,
      images: [first, { ...first, key: "products/different-key" }],
    }),
  ).toThrow(InvalidProductError);
});

it("最初の画像を代表にして、元のEntityと基本情報を変更しない", () => {
  const next = product.addImage(image("first"));
  expect(next).not.toBe(product);
  expect(next.images).toEqual([image("first")]);
  expect(next.imageKey).toBe(image("first").key);
  expect(product.images).toEqual([]);
  expect(product.imageKey).toBeNull();
  expectUnchangedDetails(next);
});
it("追加は既存代表を保ち、呼び出し元の画像オブジェクトを共有しない", () => {
  const first = product.addImage(image("first"));
  const earlier = image("second", "2026-10-03T00:00:00.000Z");
  const supplied = { ...earlier };
  const next = first.addImage(supplied);
  supplied.key = "changed-after-call";
  expect(next.imageKey).toBe(image("first").key);
  expect(next.images).toEqual([earlier, image("first")]);
  expect(first.images).toEqual([image("first")]);
  expect(Object.isFrozen(next)).toBe(true);
  expect(Object.isFrozen(next.images)).toBe(true);
  expect(next.images.every(Object.isFrozen)).toBe(true);
  expectUnchangedDetails(next);
});
it("上限まで追加でき、超過する画像は元のEntityを変えずに拒否する", () => {
  const full = fullGallery();
  const before = full.toSnapshot();
  expect(full.images).toHaveLength(PRODUCT_IMAGE_MAX_COUNT);
  expect(full.imageKey).toBe(image("image-0").key);
  expect(() => full.addImage(image("extra"))).toThrow("20");
  expect(() => full.addImage(image("extra"))).toThrow(InvalidProductError);
  expect(full.images).toHaveLength(PRODUCT_IMAGE_MAX_COUNT);
  expect(full.toSnapshot()).toEqual(before);
});
it("上限時の差し替えは代表だけを置換し、残る19件と基本情報を保つ", () => {
  const full = restoreProductFixture({
    ...fullGallery().toSnapshot(),
    imageKey: image("image-9").key,
  });
  const before = full.toSnapshot();
  const next = full.replaceImage(image("replacement"));
  expect(next.images).toHaveLength(PRODUCT_IMAGE_MAX_COUNT);
  expect(next.imageKey).toBe(image("replacement").key);
  expect(next.images.some((value) => value.key === full.imageKey)).toBe(false);
  expect(next.images.filter((value) => value.id !== "replacement")).toEqual(
    full.images.filter((value) => value.key !== full.imageKey),
  );
  expect(full.imageKey).toBe(image("image-9").key);
  expect(full.toSnapshot()).toEqual(before);
  expectUnchangedDetails(next);
});
it("画像のない商品の代表差し替えは最初の画像を登録する", () => {
  const next = product.replaceImage(image("first"));
  expect(next.images).toEqual([image("first")]);
  expect(next.imageKey).toBe(image("first").key);
  expect(product.images).toEqual([]);
  expect(product.imageKey).toBeNull();
  expectUnchangedDetails(next);
});
it("代表解除後は作成日時・IDの順で最初に残る画像を代表にする", () => {
  const current = product
    .addImage(image("primary"))
    .addImage(image("image-0", "2026-10-05T00:00:00.000Z"))
    .addImage(image("image-b"))
    .addImage(image("image-a"));
  const before = current.toSnapshot();
  const next = current.removeImage("primary");
  expect(next.imageKey).toBe(image("image-a").key);
  expect(next.images.map((value) => value.id)).toEqual(["image-a", "image-b", "image-0"]);
  expect(next.removeImage("image-a").imageKey).toBe(image("image-b").key);
  expect(current.imageKey).toBe(image("primary").key);
  expect(current.toSnapshot()).toEqual(before);
  expectUnchangedDetails(next);
});
it("代表以外の画像だけを解除し、同じ解除の再実行では状態を変えない", () => {
  const current = product.addImage(image("primary")).addImage(image("secondary"));
  const before = current.toSnapshot();
  const next = current.removeImage("secondary");
  expect(next.images).toEqual([image("primary")]);
  expect(next.imageKey).toBe(image("primary").key);
  expect(next.removeImage("secondary")).toBe(next);
  expect(next.removeImage("missing")).toBe(next);
  expect(current.toSnapshot()).toEqual(before);
  expectUnchangedDetails(next);
});
it("解除済みの代表を再解除しても新しく選んだ代表を消さない", () => {
  const current = product.addImage(image("primary")).addImage(image("secondary"));
  const next = current.removeImage("primary");
  expect(next.removeImage("primary")).toBe(next);
  expect(next.images).toEqual([image("secondary")]);
  expect(next.imageKey).toBe(image("secondary").key);
});
it("最後の画像を解除すると画像一覧と代表を両方空にする", () => {
  const current = product.addImage(image("only"));
  const next = current.removeImage("only");
  expect(next.images).toEqual([]);
  expect(next.imageKey).toBeNull();
  expect(next.removeImage("only")).toBe(next);
  expect(current.images).toEqual([image("only")]);
  expect(current.imageKey).toBe(image("only").key);
  expectUnchangedDetails(next);
});
it.each(["addImage", "replaceImage"] as const)("%sは既存の画像ID・キーを再利用しない", (method) => {
  const current = product.addImage(image("primary")).addImage(image("secondary"));
  const before = current.toSnapshot();
  for (const existing of current.images) {
    expect(() => current[method]({ ...image("different"), id: existing.id })).toThrow(
      InvalidProductError,
    );
    expect(() => current[method]({ ...image("different"), key: existing.key })).toThrow(
      InvalidProductError,
    );
  }

  expect(current.toSnapshot()).toEqual(before);
});
it.each([
  { id: "" },
  { id: "  " },
  { key: "" },
  { key: "  " },
  { createdAt: "" },
  { createdAt: " \t" },
  { createdAt: "not-a-date" },
])("未検証の画像メタデータを追加・差し替えの両方で拒否する: %j", (invalid) => {
  const current = product.addImage(image("existing"));
  const before = current.toSnapshot();
  expect(() => current.addImage({ ...image("new"), ...invalid })).toThrow(InvalidProductError);
  expect(() => current.replaceImage({ ...image("new"), ...invalid })).toThrow(InvalidProductError);
  expect(current.toSnapshot()).toEqual(before);
});
it("画像操作は凍結した別Entityを返し、変更元と呼び出し元の画像から独立する", () => {
  const current = product.addImage(image("primary")).addImage(image("secondary"));
  const before = current.toSnapshot();
  const supplied = { ...image("new") };
  const added = current.addImage(supplied);
  const replaced = current.replaceImage(supplied);
  const removed = current.removeImage("primary");
  for (const next of [added, replaced, removed]) {
    expect(next).toBeInstanceOf(Product);
    expect(next).not.toBe(current);
    expect(next.images).not.toBe(current.images);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.images)).toBe(true);
    expect(next.images.every(Object.isFrozen)).toBe(true);
    expectUnchangedDetails(next);
  }

  expect(current.toSnapshot()).toEqual(before);
  supplied.key = "products/changed-outside";
  expect(added.images).toContainEqual(image("new"));
  expect(replaced.images).toContainEqual(image("new"));
});
it("画像操作後も同じスナップショットから復元できる", () => {
  const added = product.addImage(image("one")).addImage(image("two"));
  const replaced = added.replaceImage(image("three"));
  const removedPrimary = replaced.removeImage("three");
  const removedSecondary = replaced.removeImage("two");
  const cleared = removedPrimary.removeImage("two");
  for (const current of [added, replaced, removedPrimary, removedSecondary, cleared]) {
    const restored = restoreProductFixture(current.toSnapshot());
    expect(restored).toBeInstanceOf(Product);
    expect(restored).not.toBe(current);
    expect(restored).toEqual(current);
    expect(restored.toSnapshot()).toEqual(current.toSnapshot());
    expectUnchangedDetails(current);
  }
});
it.each([false, true])("受理済みの日時形式が混在してもSQLと同じ日時・ID順を保つ: %s", (reverse) => {
  const candidates = [image("image-z", "2026-10-04"), image("image-a", "2026-10-04 01:00:00")];
  const order = reverse ? [...candidates].reverse() : candidates;
  const current = order.reduce(
    (value, next) => value.addImage(next),
    product.addImage(image("primary")),
  );
  const removed = current.removeImage("primary");
  expect(removed.images.map((value) => value.id)).toEqual(["image-z", "image-a"]);
  expect(removed.imageKey).toBe(image("image-z").key);
});

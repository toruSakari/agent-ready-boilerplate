// @vitest-environment node
import { afterAll, beforeAll, beforeEach, expect, it } from "vite-plus/test";
import { getPlatformProxy } from "wrangler";
import { fileURLToPath } from "node:url";
import { Product } from "#api/domain/product/entities/product.ts";
import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { ProductName } from "#api/domain/shared/value-objects/product-name.ts";
import { UnitPrice } from "#api/domain/shared/value-objects/unit-price.ts";
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { D1ProductRepository } from "#api/infrastructure/product/repositories/d1-product-repository.ts";
import { D1ProductImageStore } from "#api/infrastructure/product/storage/d1-product-image-store.ts";
import { migrateTestDatabase } from "#api/test/migrate-test-database.ts";
import { productValues } from "#api/test/domain-values.ts";
import type { ProductImageSnapshot } from "#api/domain/product/entities/product.ts";

const NOW = "2026-10-04T00:00:00.000Z";
const DUE = "2026-10-11T00:00:00.000Z";
let platform: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
let repository: D1ProductRepository;
let staging: D1ProductImageStore;
let initial: Product;

beforeAll(async () => {
  platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath: fileURLToPath(new URL("../storage/wrangler.images-test.jsonc", import.meta.url)),
    persist: false,
  });
  await migrateTestDatabase(platform.env.DB);
  repository = new D1ProductRepository(platform.env.DB);
  staging = new D1ProductImageStore(platform.env.DB);
}, 30_000);

afterAll(async () => {
  await platform?.dispose();
});

beforeEach(async () => {
  for (const table of ["product_images", "products", "inventory_items", "inventory_adjustments"]) {
    await platform.env.DB.prepare(`DELETE FROM ${table}`).run();
  }

  initial = Product.create({
    tenantId: "shop",
    sku: Sku.create("fixture"),
    name: ProductName.create("商品"),
    unitPrice: UnitPrice.create(100),
  });
  await repository.register(initial, StockQuantity.create(0), "merchant");
});

function image(id: string): ProductImageSnapshot {
  return { id, key: `products/${id}`, createdAt: NOW };
}

function condition(product: Product) {
  return { expectedKey: product.imageKey, now: NOW, deleteAfter: DUE };
}

async function stage(id: string) {
  await staging.stageImage({
    tenantId: initial.tenantId,
    productId: initial.id,
    image: image(id),
    deleteAfter: DUE,
  });
}

async function current() {
  const product = await repository.find(initial.tenantId, initial.id);
  if (!product) {
    throw new Error("商品fixtureがありません");
  }

  return product;
}

async function add(id: string) {
  const product = await current();
  await stage(id);
  expect(await repository.attachImage(product.addImage(image(id)), id, condition(product))).toBe(
    true,
  );
  return current();
}

async function lifecycle(id: string) {
  return platform.env.DB.prepare(
    "SELECT state, removed_at, delete_after, mutation_id FROM product_images WHERE id = ?",
  )
    .bind(id)
    .first();
}

it("画像の仮登録だけではProductの有効画像と代表参照を変更しない", async () => {
  await stage("staged");
  expect((await current()).toSnapshot()).toEqual(initial.toSnapshot());
  expect(await lifecycle("staged")).toMatchObject({ state: "staged", delete_after: DUE });
  const changed = initial.addImage(image("staged"));
  expect(await repository.attachImage(changed, "staged", condition(initial))).toBe(true);
  expect((await current()).toSnapshot()).toEqual(changed.toSnapshot());
});

it.each([{ key: "products/other" }, { createdAt: "2026-10-05T00:00:00.000Z" }])(
  "Entityと仮登録のメタデータが異なる画像を保存しない: %j",
  async (mismatch) => {
    await stage("staged");
    const changed = initial.addImage({ ...image("staged"), ...mismatch });
    expect(await repository.attachImage(changed, "staged", condition(initial))).toBe(false);
    expect((await current()).images).toEqual([]);
    expect(await lifecycle("staged")).toMatchObject({ state: "staged", delete_after: DUE });
  },
);

it("Entityにない画像の添付と、解除されていない画像の削除を拒否する", async () => {
  await stage("missing");
  expect(await repository.attachImage(initial, "missing", condition(initial))).toBe(false);
  const product = await add("active");
  expect(await repository.removeImage(product, "active", condition(product))).toBe(false);
  expect((await current()).toSnapshot()).toEqual(product.toSnapshot());
});

it("Entityに旧代表を残した差し替え要求は保存せず、正しい差分だけを受け入れる", async () => {
  const product = await add("old");
  await stage("replacement");
  const inconsistent = Product.restore(
    productValues({
      ...product.toSnapshot(),
      images: [...product.images, image("replacement")],
      imageKey: image("replacement").key,
    }),
  );
  expect(await repository.attachImage(inconsistent, "replacement", condition(product))).toBe(false);
  expect(await lifecycle("old")).toMatchObject({ state: "active" });
  expect(await lifecycle("replacement")).toMatchObject({ state: "staged" });
  const changed = product.replaceImage(image("replacement"));
  expect(await repository.attachImage(changed, "replacement", condition(product))).toBe(true);
  expect((await current()).toSnapshot()).toEqual(changed.toSnapshot());
});

it("別企業のEntityから添付・削除しても画像と代表参照を変更しない", async () => {
  const product = await add("old");
  await stage("next");
  const foreign = Product.restore(productValues({ ...product.toSnapshot(), tenantId: "foreign" }));
  expect(
    await repository.attachImage(foreign.replaceImage(image("next")), "next", condition(product)),
  ).toBe(false);
  expect(await repository.removeImage(foreign.removeImage("old"), "old", condition(product))).toBe(
    false,
  );
  expect((await current()).toSnapshot()).toEqual(product.toSnapshot());
});

it("同じ企業でも別商品のEntityから画像を添付・削除しない", async () => {
  const product = await add("old");
  await stage("next");
  const other = Product.restore(
    productValues({ ...initial.toSnapshot(), id: "other", sku: "other" }),
  );
  await repository.register(other, StockQuantity.create(0), "merchant");
  expect(
    await repository.attachImage(other.addImage(image("next")), "next", condition(other)),
  ).toBe(false);
  expect(await repository.removeImage(other, "old", condition(product))).toBe(false);
  expect((await current()).toSnapshot()).toEqual(product.toSnapshot());
});

it("最後の画像の解除前に追加された画像があれば競合にし、再取得後の解除で代表を残す", async () => {
  const product = await add("old");
  const removed = product.removeImage("old");
  await add("concurrent");
  expect(await repository.removeImage(removed, "old", condition(product))).toBe(false);
  expect(await lifecycle("old")).toMatchObject({
    state: "active",
    removed_at: null,
    delete_after: null,
  });
  const fresh = await current();
  expect(fresh.imageKey).toBe(image("old").key);
  expect(await repository.removeImage(fresh.removeImage("old"), "old", condition(fresh))).toBe(
    true,
  );
  expect((await current()).imageKey).toBe(image("concurrent").key);
});

it("次の代表候補が並行して削除された場合は元の代表も退役させない", async () => {
  await add("a-primary");
  await add("b-next");
  const product = await add("c-last");
  expect(
    await repository.removeImage(product.removeImage("b-next"), "b-next", condition(product)),
  ).toBe(true);
  expect(
    await repository.removeImage(product.removeImage("a-primary"), "a-primary", condition(product)),
  ).toBe(false);
  expect((await current()).imageKey).toBe(image("a-primary").key);
  expect(await lifecycle("a-primary")).toMatchObject({ state: "active", delete_after: null });
  const fresh = await current();
  expect(
    await repository.removeImage(fresh.removeImage("a-primary"), "a-primary", condition(fresh)),
  ).toBe(true);
  expect((await current()).imageKey).toBe(image("c-last").key);
});

it("代表の並行差し替えは勝者の画像だけを有効化し、敗者の保持記録を残す", async () => {
  const product = await add("old");
  await Promise.all([stage("next-a"), stage("next-b")]);
  const results = await Promise.all([
    repository.attachImage(product.replaceImage(image("next-a")), "next-a", condition(product)),
    repository.attachImage(product.replaceImage(image("next-b")), "next-b", condition(product)),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  const winner = results[0] ? "next-a" : "next-b";
  const loser = results[0] ? "next-b" : "next-a";
  expect((await current()).images).toEqual([image(winner)]);
  expect(await lifecycle("old")).toMatchObject({
    state: "retired",
    removed_at: NOW,
    delete_after: DUE,
  });
  expect(await lifecycle(loser)).toMatchObject({
    state: "staged",
    removed_at: null,
    delete_after: DUE,
  });
});

it("古い代表画像の解除を拒否して、新しい代表と保持期限を変更しない", async () => {
  const product = await add("old");
  await stage("next");
  expect(
    await repository.attachImage(product.replaceImage(image("next")), "next", condition(product)),
  ).toBe(true);
  const retired = await lifecycle("old");
  expect(await repository.removeImage(product.removeImage("old"), "old", condition(product))).toBe(
    false,
  );
  expect((await current()).imageKey).toBe(image("next").key);
  expect(await lifecycle("old")).toEqual(retired);
});

it("代表以外の同時解除は両方保存し、並行した基本情報更新を上書きしない", async () => {
  await add("a-primary");
  await add("b-side");
  const product = await add("c-side");
  expect(
    await repository.updateDetails(
      product.updateDetails({
        name: ProductName.create("新名称"),
        unitPrice: UnitPrice.create(200),
      }),
      { name: product.name, unitPrice: product.unitPrice },
    ),
  ).toBe(true);
  expect(
    await Promise.all([
      repository.removeImage(product.removeImage("b-side"), "b-side", condition(product)),
      repository.removeImage(product.removeImage("c-side"), "c-side", condition(product)),
    ]),
  ).toEqual([true, true]);
  expect(await current()).toMatchObject({
    name: "新名称",
    unitPrice: 200,
    imageKey: image("a-primary").key,
    images: [image("a-primary")],
  });
});

it("解除バッチの代表更新が失敗すると画像の状態と保持期限もロールバックする", async () => {
  const product = await add("old");
  await platform.env.DB.prepare(
    "CREATE TRIGGER reject_image_removal BEFORE UPDATE OF image_key ON products BEGIN SELECT RAISE(ABORT, 'test failure'); END",
  ).run();
  try {
    await expect(
      repository.removeImage(product.removeImage("old"), "old", condition(product)),
    ).rejects.toThrow();
    expect((await current()).toSnapshot()).toEqual(product.toSnapshot());
    expect(await lifecycle("old")).toMatchObject({
      state: "active",
      removed_at: null,
      delete_after: null,
    });
  } finally {
    await platform.env.DB.prepare("DROP TRIGGER reject_image_removal").run();
  }
});

function lostResponseRepository() {
  return new D1ProductRepository(
    new Proxy(platform.env.DB, {
      get(target, property) {
        if (property === "batch") {
          return async (statements: D1PreparedStatement[]) => {
            await target.batch(statements);
            throw new Error("response lost after commit");
          };
        }

        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  );
}

it("添付応答が失われても同じEntityの再保存は重複せず、後の差し替えを巻き戻さない", async () => {
  await stage("once");
  const changed = initial.addImage(image("once"));
  await expect(
    lostResponseRepository().attachImage(changed, "once", condition(initial)),
  ).rejects.toThrow("response lost");
  expect(await repository.attachImage(changed, "once", condition(initial))).toBe(true);
  expect((await current()).toSnapshot()).toEqual(changed.toSnapshot());
  await stage("newer");
  const replacement = changed.replaceImage(image("newer"));
  expect(await repository.attachImage(replacement, "newer", condition(changed))).toBe(true);
  expect(await repository.attachImage(changed, "once", condition(initial))).toBe(false);
  expect((await current()).toSnapshot()).toEqual(replacement.toSnapshot());
});

it("解除応答が失われても再取得で確定状態を確認でき、再保存で保持期限を延ばさない", async () => {
  await add("a-primary");
  const product = await add("b-remaining");
  const removed = product.removeImage("a-primary");
  await expect(
    lostResponseRepository().removeImage(removed, "a-primary", condition(product)),
  ).rejects.toThrow("response lost");
  expect((await current()).toSnapshot()).toEqual(removed.toSnapshot());
  const retired = await lifecycle("a-primary");
  expect(
    await repository.removeImage(removed, "a-primary", {
      expectedKey: product.imageKey,
      now: DUE,
      deleteAfter: "2026-10-18T00:00:00.000Z",
    }),
  ).toBe(false);
  expect(await lifecycle("a-primary")).toEqual(retired);
  expect((await current()).imageKey).toBe(image("b-remaining").key);
});

it("次の代表より前に並ぶ画像が並行追加されたら古い候補で解除せず、再取得後に順序を守る", async () => {
  await add("a-primary");
  const product = await add("z-next");
  await add("b-concurrent");
  expect(
    await repository.removeImage(product.removeImage("a-primary"), "a-primary", condition(product)),
  ).toBe(false);
  expect((await current()).imageKey).toBe(image("a-primary").key);
  expect(await lifecycle("a-primary")).toMatchObject({ state: "active", delete_after: null });
  const fresh = await current();
  expect(
    await repository.removeImage(fresh.removeImage("a-primary"), "a-primary", condition(fresh)),
  ).toBe(true);
  expect((await current()).imageKey).toBe(image("b-concurrent").key);
});

import { Product } from "#api/domain/product/entities/product.ts";
import { CleanupProductImagesInputDto } from "#api/application/product/dtos/cleanup-product-images-input-dto.ts";
// @vitest-environment node
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { D1ProductImageStore } from "#api/infrastructure/product/storage/d1-product-image-store.ts";
import { D1ProductImageCleanupStore } from "#api/infrastructure/product/storage/d1-product-image-cleanup-store.ts";
import { D1ProductRepository } from "#api/infrastructure/product/repositories/d1-product-repository.ts";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { products } from "#api/infrastructure/product/schemas/schema.ts";
import { cursorPagination } from "#api/infrastructure/shared/cursor-pagination.ts";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vite-plus/test";
import {
  IMAGE_CLEANUP_LEASE_MS,
  IMAGE_RETENTION_MS,
} from "#api/application/product/policies/image-policy.ts";
import { CleanupProductImagesUseCase } from "#api/application/product/use-cases/cleanup-product-images-use-case.ts";

import { productValues } from "#api/test/domain-values.ts";
import { R2ProductImageStorage } from "#api/infrastructure/product/storage/r2-product-image-storage.ts";

const API_DIRECTORY = fileURLToPath(new URL("../../../../", import.meta.url));
const NOW = "2026-10-04T00:00:00.000Z";
const DUE = new Date(Date.parse(NOW) + IMAGE_RETENTION_MS).toISOString();
// 実時間を待たずに最短保持期限の直前と削除リース満了を別々に検証する。
const JUST_BEFORE_DUE = new Date(Date.parse(DUE) - 1).toISOString();
const AFTER_LEASE = new Date(Date.parse(DUE) + IMAGE_CLEANUP_LEASE_MS).toISOString();
const TENANT = "image-tenant";
const PRODUCT = "image-product";
const CLAIM_LIMIT = 20;
let platform: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let repository: D1ProductRepository;
let imageStore: D1ProductImageStore;
let cleanupStore: D1ProductImageCleanupStore;
let productQuery: D1ProductRepository;
let storage: R2ProductImageStorage;
let migrated: Awaited<ReturnType<D1ProductRepository["list"]>>;
beforeAll(async () => {
  platform = await getPlatformProxy<Env>({
    configPath: fileURLToPath(new URL("./wrangler.images-test.jsonc", import.meta.url)),
    persist: false,
  });
  for (const file of readdirSync(join(API_DIRECTORY, "drizzle"))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    if (file.startsWith("0010_")) {
      for (const id of ["legacy-a", "legacy-b", "legacy-empty"]) {
        await platform.env.DB.prepare(`
          INSERT INTO products (id, tenant_id, sku, name, unit_price, image_key, created_at)
          VALUES (?, 'legacy', ?, '既存商品', 100, ?, ?)
        `)
          .bind(id, id, id === "legacy-empty" ? null : "legacy/shared", NOW)
          .run();
      }
    }

    for (const statement of readFileSync(join(API_DIRECTORY, "drizzle", file), "utf8").split(
      file.startsWith("0014_") ? "--> statement-breakpoint" : ";",
    )) {
      const sql = statement.replace(/--[^\n]*/g, "").trim();
      if (sql) {
        await platform.env.DB.prepare(sql).run();
      }
    }
  }

  repository = new D1ProductRepository(platform.env.DB);
  imageStore = new D1ProductImageStore(platform.env.DB);
  cleanupStore = new D1ProductImageCleanupStore(platform.env.DB);
  productQuery = new D1ProductRepository(platform.env.DB);
  storage = new R2ProductImageStorage(platform.env.PRODUCT_IMAGES);
  migrated = await productQuery.list("legacy");
}, 30000);
afterAll(async () => {
  await platform?.dispose();
});
beforeEach(async () => {
  vi.restoreAllMocks();
  await platform.env.DB.prepare("DELETE FROM product_images").run();
  await platform.env.DB.prepare("DELETE FROM products").run();
  await platform.env.DB.prepare("DELETE FROM inventory_items").run();
  await platform.env.DB.prepare("DELETE FROM inventory_adjustments").run();
  await platform.env.DB.prepare("DELETE FROM orders").run();
  await create(PRODUCT, TENANT);
});

async function create(id: string, tenantId: string) {
  await new D1ProductRepository(platform.env.DB).register(
    Product.restore(
      productValues({
        id,
        tenantId,
        sku: id,
        name: "商品",
        unitPrice: 100,
        imageKey: null,
        images: [],
        createdAt: NOW,
      }),
    ),
    StockQuantity.create(0),
    "business:image-fixture",
  );
}

function image(id: string) {
  return { id, key: `test/${id}`, createdAt: NOW };
}

async function stage(id: string, productId = PRODUCT, tenantId = TENANT) {
  await imageStore.stageImage({ tenantId, productId, image: image(id), deleteAfter: DUE });
}

async function plannedAttachment(
  id: string,
  replace = false,
  productId = PRODUCT,
  tenantId = TENANT,
) {
  const current = await repository.find(tenantId, productId);
  if (!current) {
    throw new Error("商品fixtureがありません");
  }

  // 既にactiveの場合も同じ保存意図を再構成し、Repositoryの再実行ガードを検証する。
  const withoutNew = current.removeImage(id);
  return replace ? withoutNew.replaceImage(image(id)) : withoutNew.addImage(image(id));
}

async function attach(id: string, expectedKey: string | null = null, replace = false) {
  return repository.attachImage(await plannedAttachment(id, replace), id, {
    expectedKey,
    now: NOW,
    deleteAfter: DUE,
  });
}

async function remove(
  id: string,
  productId = PRODUCT,
  tenantId = TENANT,
  now = NOW,
  deleteAfter = DUE,
) {
  const current = await repository.find(tenantId, productId);
  if (!current) {
    return false;
  }

  return repository.removeImage(current.removeImage(id), id, {
    expectedKey: current.imageKey,
    now,
    deleteAfter,
  });
}

async function claim(now = DUE, claimToken = "claim") {
  return cleanupStore.claimImageGarbage({
    now,
    claimToken,
    limit: CLAIM_LIMIT,
    leaseUntil: new Date(Date.parse(now) + IMAGE_CLEANUP_LEASE_MS).toISOString(),
  });
}

async function state(id: string) {
  return platform.env.DB.prepare("SELECT state FROM product_images WHERE id = ?")
    .bind(id)
    .first<string>("state");
}

async function orderWithLines(lines: string) {
  await platform.env.DB.prepare(`
    INSERT INTO orders (id, tenant_id, customer_id, lines, total, created_at, version)
    VALUES ('historical-order', ?, 'customer', ?, 100, ?, 0)
  `)
    .bind(TENANT, lines, NOW)
    .run();
}

it("商品画像のD1・R2整合性 / 旧主画像・共有キー・画像なし商品を損失なく移行する", () => {
  expect(migrated).toHaveLength(3);
  for (const product of migrated) {
    expect(product.images).toEqual(
      product.id === "legacy-empty"
        ? []
        : [
            {
              id: `legacy:${product.id}`,
              key: "legacy/shared",
              createdAt: NOW,
            },
          ],
    );
    expect(product.imageKey).toBe(product.id === "legacy-empty" ? null : "legacy/shared");
  }
});
it("商品画像のD1・R2整合性 / 複数画像を保持し、主画像を削除すると次の画像を選ぶ", async () => {
  await stage("gallery-a");
  expect(await attach("gallery-a")).toBe(true);
  await stage("gallery-b");
  expect(await attach("gallery-b", image("gallery-a").key)).toBe(true);
  expect((await repository.find(TENANT, PRODUCT))?.images.map((props) => props.id)).toEqual([
    "gallery-a",
    "gallery-b",
  ]);
  expect(await remove("gallery-a")).toBe(true);
  expect(await repository.find(TENANT, PRODUCT)).toMatchObject({
    imageKey: image("gallery-b").key,
    images: [image("gallery-b")],
  });
  expect(await remove("gallery-b")).toBe(true);
  expect(await repository.find(TENANT, PRODUCT)).toMatchObject({ imageKey: null, images: [] });
});
it("商品画像のD1・R2整合性 / 差し替えは主画像だけを置換し、旧画像を7日間保持する", async () => {
  await stage("replace-a");
  await attach("replace-a");
  await stage("replace-b");
  await attach("replace-b", image("replace-a").key);
  await stage("replace-c");
  expect(await attach("replace-c", image("replace-a").key, true)).toBe(true);
  expect(await repository.find(TENANT, PRODUCT)).toMatchObject({
    imageKey: image("replace-c").key,
    images: [image("replace-b"), image("replace-c")],
  });
  expect(await claim(JUST_BEFORE_DUE)).toEqual([]);
  expect(await claim()).toEqual([{ imageId: "replace-a", key: image("replace-a").key }]);
});
it("商品画像のD1・R2整合性 / 競合した主画像更新と別企業からの添付・削除を拒否する", async () => {
  await stage("winner");
  await stage("loser");
  expect(await attach("winner")).toBe(true);
  expect(await attach("loser")).toBe(false);
  expect(await state("loser")).toBe("staged");
  expect(await repository.find("foreign", PRODUCT)).toBeNull();
  await expect(stage("foreign", PRODUCT, "foreign")).rejects.toThrow();
  expect(
    await repository.attachImage(
      Product.restore(
        productValues({
          ...(await plannedAttachment("loser", true)).toSnapshot(),
          tenantId: "foreign",
        }),
      ),
      "loser",
      { expectedKey: image("winner").key, now: NOW, deleteAfter: DUE },
    ),
  ).toBe(false);
  expect(await remove("winner", PRODUCT, "foreign")).toBe(false);
  expect((await repository.find(TENANT, PRODUCT))?.imageKey).toBe(image("winner").key);
});
it("商品画像のD1・R2整合性 / コミット後の応答喪失でも有効画像をGCせず、同じ添付の再試行は安全", async () => {
  await stage("commit-unknown");
  // DBコミット自体は成功させ、応答だけを失わせる。失敗応答と未保存を同一視しない回帰条件。
  const uncertain = new D1ProductRepository(
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
  await expect(
    uncertain.attachImage(await plannedAttachment("commit-unknown"), "commit-unknown", {
      expectedKey: null,
      now: NOW,
      deleteAfter: DUE,
    }),
  ).rejects.toThrow("response lost");
  expect((await repository.find(TENANT, PRODUCT))?.imageKey).toBe(image("commit-unknown").key);
  expect(await claim()).toEqual([]);
  expect(await attach("commit-unknown")).toBe(true);
  await stage("additional");
  await attach("additional", image("commit-unknown").key);
  // 使用済みの添付操作を再利用しても、後から別の代表画像変更へ転用できない。
  expect(await attach("additional", image("commit-unknown").key, true)).toBe(true);
  expect((await repository.find(TENANT, PRODUCT))?.imageKey).toBe(image("commit-unknown").key);
});
it("商品画像のD1・R2整合性 / 履歴JSON内の旧画像キーと不正JSONは削除候補から保護する", async () => {
  await stage("historical");
  await attach("historical");
  await remove("historical");
  await orderWithLines(JSON.stringify([{ sku: "legacy", imageKey: image("historical").key }]));
  expect(await claim()).toEqual([]);
  await platform.env.DB.prepare("UPDATE orders SET lines = 'corrupt'").run();
  expect(await claim()).toEqual([]);
  await platform.env.DB.prepare("UPDATE orders SET lines = '[]'").run();
  expect(await claim()).toEqual([{ imageId: "historical", key: image("historical").key }]);
});
it("商品画像のD1・R2整合性 / 旧共有キーは全商品の参照と保持期限が切れるまで削除しない", async () => {
  await stage("shared");
  await attach("shared");
  await create("other-product", "other-tenant");
  await platform.env.DB.prepare(`
      INSERT INTO product_images (id, tenant_id, products_id, image_key, state, created_at)
      VALUES ('shared-copy', 'other-tenant', 'other-product', ?, 'active', ?)
    `)
    .bind(image("shared").key, NOW)
    .run();
  await platform.env.DB.prepare("UPDATE products SET image_key = ? WHERE id = 'other-product'")
    .bind(image("shared").key)
    .run();
  await remove("shared");
  expect(await claim()).toEqual([]);
  await remove("shared-copy", "other-product", "other-tenant", DUE, AFTER_LEASE);
  expect(await claim()).toEqual([]);
  const candidates = await claim(AFTER_LEASE);
  expect(candidates.map((props) => props.imageId).sort()).toEqual(["shared", "shared-copy"]);
  await cleanupStore.completeImageGarbage({ imageId: "shared", claimToken: "claim" });
  expect(
    await claim(new Date(Date.parse(AFTER_LEASE) + IMAGE_CLEANUP_LEASE_MS).toISOString()),
  ).toEqual([{ imageId: "shared-copy", key: image("shared").key }]);
});
it("商品画像のD1・R2整合性 / 失敗・放棄アップロードを回収し、削除中・削除済みキーの再利用を防ぐ", async () => {
  await stage("abandoned");
  expect(await claim(JUST_BEFORE_DUE)).toEqual([]);
  expect(await claim()).toEqual([{ imageId: "abandoned", key: image("abandoned").key }]);
  expect(await attach("abandoned")).toBe(false);
  expect(await claim(DUE, "other-claim")).toEqual([]);
  expect(await claim(AFTER_LEASE, "retry-claim")).toHaveLength(1);
  await cleanupStore.completeImageGarbage({ imageId: "abandoned", claimToken: "claim" });
  expect(await state("abandoned")).toBe("deleting");
  await cleanupStore.completeImageGarbage({ imageId: "abandoned", claimToken: "retry-claim" });
  expect(await state("abandoned")).toBe("deleted");
  expect(await attach("abandoned")).toBe(false);
  await expect(
    imageStore.stageImage({
      tenantId: TENANT,
      productId: PRODUCT,
      image: { ...image("abandoned"), id: "reused" },
      deleteAfter: DUE,
    }),
  ).rejects.toThrow();
});
it("商品画像のD1・R2整合性 / 並行した追加は既存の主画像と各画像を失わない", async () => {
  await stage("parallel-primary");
  await attach("parallel-primary");
  await Promise.all([stage("parallel-a"), stage("parallel-b")]);
  const [nextA, nextB] = await Promise.all([
    plannedAttachment("parallel-a"),
    plannedAttachment("parallel-b"),
  ]);
  const condition = { expectedKey: image("parallel-primary").key, now: NOW, deleteAfter: DUE };
  expect(
    await Promise.all([
      repository.attachImage(nextA, "parallel-a", condition),
      repository.attachImage(nextB, "parallel-b", condition),
    ]),
  ).toEqual([true, true]);
  const product = await repository.find(TENANT, PRODUCT);
  expect(product?.images).toHaveLength(3);
  expect(product?.imageKey).toBe(image("parallel-primary").key);
});
it("商品画像のD1・R2整合性 / バッチ途中のDB障害は主画像・有効画像・保持期限をまとめてロールバックする", async () => {
  await stage("rollback-old");
  await attach("rollback-old");
  await stage("rollback-next");
  await platform.env.DB.prepare(`
      CREATE TRIGGER fail_product_image_update BEFORE UPDATE OF image_key ON products
      BEGIN SELECT RAISE(ABORT, 'image update failed'); END
    `).run();
  try {
    await expect(attach("rollback-next", image("rollback-old").key, true)).rejects.toThrow();
    expect(await state("rollback-old")).toBe("active");
    expect(await state("rollback-next")).toBe("staged");
    expect((await repository.find(TENANT, PRODUCT))?.imageKey).toBe(image("rollback-old").key);
    expect(await claim()).toEqual([{ imageId: "rollback-next", key: image("rollback-next").key }]);
  } finally {
    await platform.env.DB.prepare("DROP TRIGGER fail_product_image_update").run();
  }
});
it("商品画像のD1・R2整合性 / 期限切れアップロードの添付を拒否し、旧主画像の直接参照も保護する", async () => {
  await stage("expired");
  expect(
    await repository.attachImage(await plannedAttachment("expired"), "expired", {
      expectedKey: null,
      now: DUE,
      deleteAfter: AFTER_LEASE,
    }),
  ).toBe(false);
  await platform.env.DB.prepare("UPDATE products SET image_key = ? WHERE id = ?")
    .bind(image("expired").key, PRODUCT)
    .run();
  expect(await claim()).toEqual([]);
});
it("商品画像のD1・R2整合性 / R2削除失敗と削除後のDB応答喪失を再試行して収束する", async () => {
  await stage("cleanup-retry");
  await storage.put(image("cleanup-retry").key, new Uint8Array([1]).buffer, "image/png");
  await expect(
    storage.put(image("cleanup-retry").key, new Uint8Array([2]).buffer, "image/png"),
  ).rejects.toThrow("再利用");
  const deletion = vi.spyOn(storage, "delete").mockRejectedValueOnce(new Error("R2 unavailable"));
  let now = new Date(DUE);
  const cleanup = new CleanupProductImagesUseCase(cleanupStore, storage, () => now);
  expect(await cleanup.execute(CleanupProductImagesInputDto.parse({}))).toEqual({
    deleted: 0,
    failed: 1,
  });
  expect(await storage.get(image("cleanup-retry").key)).not.toBeNull();
  now = new Date(AFTER_LEASE);
  vi.spyOn(cleanupStore, "completeImageGarbage").mockRejectedValueOnce(new Error("D1 unavailable"));
  expect(await cleanup.execute(CleanupProductImagesInputDto.parse({}))).toEqual({
    deleted: 0,
    failed: 1,
  });
  expect(await storage.get(image("cleanup-retry").key)).toBeNull();
  expect(await state("cleanup-retry")).toBe("deleting");
  now = new Date(now.getTime() + IMAGE_CLEANUP_LEASE_MS);
  expect(await cleanup.execute(CleanupProductImagesInputDto.parse({}))).toEqual({
    deleted: 1,
    failed: 0,
  });
  expect(deletion).toHaveBeenCalledTimes(3);
  expect(await state("cleanup-retry")).toBe("deleted");
});
it("商品単位のページングで他企業を除外し、複数画像を途中で切らない", async () => {
  await create("a-first", TENANT);
  await create("b-second", TENANT);
  await create("foreign", "other");
  for (const id of ["page-one", "page-two"]) {
    await stage(id, "a-first");
    expect(
      await repository.attachImage(await plannedAttachment(id, false, "a-first"), id, {
        expectedKey: id === "page-one" ? null : "test/page-one",
        now: NOW,
        deleteAfter: DUE,
      }),
    ).toBe(true);
  }

  const first = await productQuery.list(TENANT, { limit: 1 });
  expect(first.map((p) => p.id)).toEqual(["a-first"]);
  expect(first[0]!.images.map((i) => i.id)).toEqual(["page-one", "page-two"]);
  const second = await productQuery.list(TENANT, {
    limit: 1,
    cursor: { createdAt: first[0]!.createdAt, id: first[0]!.id },
  });
  expect(second.map((p) => p.id)).toEqual(["b-second"]);
});
it("同時追加でも20件を超えず、上限時も代表画像を置き換えられる", async () => {
  for (let i = 0; i < 19; i++) {
    const id = `quota-${i}`;
    await stage(id);
    expect(await attach(id, i === 0 ? null : "test/quota-0")).toBe(true);
  }

  await stage("quota-a");
  await stage("quota-b");
  const [nextA, nextB] = await Promise.all([
    plannedAttachment("quota-a"),
    plannedAttachment("quota-b"),
  ]);
  const condition = { expectedKey: "test/quota-0", now: NOW, deleteAfter: DUE };
  const results = await Promise.all([
    repository.attachImage(nextA, "quota-a", condition),
    repository.attachImage(nextB, "quota-b", condition),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect((await repository.find(TENANT, PRODUCT))!.images).toHaveLength(20);
  await stage("replacement");
  expect(await attach("replacement", "test/quota-0", true)).toBe(true);
  expect((await repository.find(TENANT, PRODUCT))!.images).toHaveLength(20);
});
it("商品ページは削除された境界からも続き、新しい商品を混ぜない", async () => {
  await create("a-boundary", TENANT);
  await create("b-next", TENANT);
  const first = (await productQuery.list(TENANT, { limit: 1 }))[0]!;
  await platform.env.DB.prepare("DELETE FROM products WHERE id = ?").bind(first.id).run();
  await create("new", TENANT);
  await platform.env.DB.prepare("UPDATE products SET created_at = ? WHERE id = ?")
    .bind("2026-10-05T00:00:00.000Z", "new")
    .run();
  const second = await productQuery.list(TENANT, {
    limit: 1,
    cursor: { createdAt: first.createdAt, id: first.id },
  });
  expect(second.map((product) => product.id)).toEqual(["b-next"]);
  expect((await productQuery.list(TENANT, { limit: 1 }))[0]!.id).toBe("new");
  const query = await platform.env.DB.prepare(
    "EXPLAIN QUERY PLAN SELECT id FROM products WHERE tenant_id = ? ORDER BY created_at DESC, id LIMIT 1",
  )
    .bind(TENANT)
    .all();
  expect(JSON.stringify(query.results)).toContain("products_tenant_cursor_idx");
  expect(JSON.stringify(query.results)).not.toContain("TEMP B-TREE");
  const cursor = cursorPagination(products, { createdAt: first.createdAt, id: first.id });
  const continuation = drizzle(platform.env.DB)
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.tenantId, TENANT), cursor.after))
    .orderBy(...cursor.order)
    .limit(1)
    .toSQL();
  const seek = await platform.env.DB.prepare(`EXPLAIN QUERY PLAN ${continuation.sql}`)
    .bind(...continuation.params)
    .all();
  expect(JSON.stringify(seek.results)).toContain("products_tenant_cursor_idx");
  expect(JSON.stringify(seek.results)).toContain("created_at<?");
});
it("商品の基本情報更新 / 企業と読取時の価格を照合し、画像参照を更新対象に含めない", async () => {
  const current = await repository.find(TENANT, PRODUCT);
  if (!current) {
    throw new Error("商品fixtureがありません");
  }

  const next = Product.restore(
    productValues({ ...current.toSnapshot(), name: "無料商品", unitPrice: 0 }),
  );
  expect(await repository.updateDetails(next, { name: "商品", unitPrice: 999 })).toBe(false);
  expect(
    await repository.updateDetails(
      Product.restore(productValues({ ...next.toSnapshot(), tenantId: "other" })),
      {
        name: "商品",
        unitPrice: 100,
      },
    ),
  ).toBe(false);
  expect(await repository.updateDetails(next, { name: "商品", unitPrice: 100 })).toBe(true);
  expect(await repository.find(TENANT, PRODUCT)).toMatchObject({
    name: "無料商品",
    unitPrice: 0,
    imageKey: current.imageKey,
  });
  expect(await repository.updateDetails(current, { name: "商品", unitPrice: 100 })).toBe(false);
});

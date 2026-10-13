import { Product } from "#api/domain/product/entities/product.ts";
// @vitest-environment node
import { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import { migrateTestDatabase } from "#api/test/migrate-test-database.ts";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import { D1ProductRepository } from "#api/infrastructure/product/repositories/d1-product-repository.ts";

import { Sku } from "#api/domain/shared/value-objects/sku.ts";
import { ProductName } from "#api/domain/shared/value-objects/product-name.ts";
import { UnitPrice } from "#api/domain/shared/value-objects/unit-price.ts";

const API_DIRECTORY = fileURLToPath(new URL("../../../../", import.meta.url));
let platform: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
beforeAll(async () => {
  platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath: join(
      API_DIRECTORY,
      "src/infrastructure/access/repositories/wrangler.access-test.jsonc",
    ),
    persist: false,
  });
  await migrateTestDatabase(platform.env.DB);
}, 30_000);
afterAll(async () => {
  await platform?.dispose();
});

function product(sku: string, tenantId = "shop") {
  return Product.create({
    tenantId,
    sku: Sku.create(sku),
    name: ProductName.create("商品"),
    unitPrice: UnitPrice.create(100),
  });
}

it("商品と初期在庫を保存し、重複SKUで既存の在庫を上書きしない", async () => {
  const repository = new D1ProductRepository(platform.env.DB);
  await repository.register(product("stocked"), StockQuantity.create(3), "merchant");
  await expect(
    repository.register(product("stocked"), StockQuantity.create(99), "merchant"),
  ).rejects.toMatchObject({
    code: "CONFLICT",
  });
  expect(
    await platform.env.DB.prepare(
      "SELECT on_hand FROM inventory_items WHERE tenant_id = 'shop' AND sku = 'stocked'",
    ).first(),
  ).toEqual({ on_hand: 3 });
  expect(
    await platform.env.DB.prepare(
      "SELECT actor_id, before_stock, after_stock FROM inventory_adjustments WHERE tenant_id = 'shop' AND sku = 'stocked'",
    ).all(),
  ).toMatchObject({ results: [{ actor_id: "merchant", before_stock: 0, after_stock: 3 }] });
  await repository.register(product("stocked", "other"), StockQuantity.create(8), "merchant");
  expect(
    await platform.env.DB.prepare(
      "SELECT on_hand FROM inventory_items WHERE tenant_id = 'other' AND sku = 'stocked'",
    ).first(),
  ).toEqual({ on_hand: 8 });
});
it("在庫保存に失敗した場合は商品登録もロールバックする", async () => {
  await platform.env.DB.prepare(
    "CREATE TRIGGER reject_test_stock BEFORE INSERT ON inventory_items WHEN NEW.sku = 'rollback' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
  ).run();
  await expect(
    new D1ProductRepository(platform.env.DB).register(
      product("rollback"),
      StockQuantity.create(3),
      "merchant",
    ),
  ).rejects.toThrow();
  expect(
    await platform.env.DB.prepare("SELECT id FROM products WHERE sku = 'rollback'").first(),
  ).toBeNull();
  expect(
    await platform.env.DB.prepare("SELECT sku FROM inventory_items WHERE sku = 'rollback'").first(),
  ).toBeNull();
  expect(
    await platform.env.DB.prepare(
      "SELECT id FROM inventory_adjustments WHERE sku = 'rollback'",
    ).first(),
  ).toBeNull();
});

it("途中の初期履歴保存が失敗すると商品・在庫・履歴を残さず再試行できる", async () => {
  const repository = new D1ProductRepository(platform.env.DB);
  const entity = product("history-failure");
  await platform.env.DB.prepare(
    "CREATE TRIGGER reject_initial_history BEFORE INSERT ON inventory_adjustments WHEN NEW.sku = 'history-failure' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
  ).run();
  try {
    await expect(
      repository.register(entity, StockQuantity.create(7), "merchant"),
    ).rejects.toThrow();
  } finally {
    await platform.env.DB.prepare("DROP TRIGGER reject_initial_history").run();
  }

  for (const table of ["products", "inventory_items", "inventory_adjustments"]) {
    expect(
      await platform.env.DB.prepare(
        `SELECT sku FROM ${table} WHERE sku = 'history-failure'`,
      ).first(),
    ).toBeNull();
  }

  await repository.register(entity, StockQuantity.create(7), "merchant");
  expect(
    await platform.env.DB.prepare(
      "SELECT on_hand FROM inventory_items WHERE sku = 'history-failure'",
    ).first(),
  ).toEqual({ on_hand: 7 });
});
it("同じ企業・SKUの同時登録は一件だけ保存し、勝者の在庫と履歴を保つ", async () => {
  const repository = new D1ProductRepository(platform.env.DB);
  const results = await Promise.allSettled([
    repository.register(product("concurrent"), StockQuantity.create(3), "first"),
    repository.register(product("concurrent"), StockQuantity.create(8), "second"),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const quantity = results[0].status === "fulfilled" ? 3 : 8;
  expect(
    await platform.env.DB.prepare(
      "SELECT on_hand FROM inventory_items WHERE sku = 'concurrent'",
    ).first(),
  ).toEqual({ on_hand: quantity });
  expect(
    await platform.env.DB.prepare(
      "SELECT after_stock FROM inventory_adjustments WHERE sku = 'concurrent'",
    ).all(),
  ).toMatchObject({ results: [{ after_stock: quantity }] });
  expect(
    await platform.env.DB.prepare(
      "SELECT count(*) as count FROM products WHERE sku = 'concurrent'",
    ).first(),
  ).toEqual({ count: 1 });
});
it("商品がない既存台帳のSKUも拒否し、商品や初期履歴を追加しない", async () => {
  await platform.env.DB.prepare(
    "INSERT INTO inventory_items (tenant_id, sku, on_hand, updated_at) VALUES ('shop', 'orphan', 12, '2026-10-04T00:00:00.000Z')",
  ).run();
  await expect(
    new D1ProductRepository(platform.env.DB).register(
      product("orphan"),
      StockQuantity.create(99),
      "merchant",
    ),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(
    await platform.env.DB.prepare("SELECT id FROM products WHERE sku = 'orphan'").first(),
  ).toBeNull();
  expect(
    await platform.env.DB.prepare(
      "SELECT id FROM inventory_adjustments WHERE sku = 'orphan'",
    ).first(),
  ).toBeNull();
  expect(
    await platform.env.DB.prepare(
      "SELECT on_hand FROM inventory_items WHERE sku = 'orphan'",
    ).first(),
  ).toEqual({ on_hand: 12 });
});

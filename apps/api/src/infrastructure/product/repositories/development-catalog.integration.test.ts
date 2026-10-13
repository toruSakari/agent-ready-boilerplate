import { StoreListInputDto } from "#api/application/store/dtos/store-list-input-dto.ts";
// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { seedDevelopment } from "#api-tooling/seeds/seed-development.ts";
import { DEVELOPMENT_FIXTURE } from "#api-tooling/seeds/development-fixture.ts";
import { DEVELOPMENT_CATALOG } from "#api-tooling/seeds/development-catalog.ts";
import { storeReader } from "#api/test/store-reader.ts";

const API_DIRECTORY = fileURLToPath(new URL("../../../../", import.meta.url));
let platform: Awaited<
  ReturnType<
    typeof getPlatformProxy<{
      DB: D1Database;
    }>
  >
>;
beforeAll(async () => {
  platform = await getPlatformProxy<{
    DB: D1Database;
  }>({
    configPath: join(
      API_DIRECTORY,
      "src/infrastructure/access/repositories/wrangler.access-test.jsonc",
    ),
    persist: false,
  });
  for (const file of readdirSync(join(API_DIRECTORY, "drizzle"))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    const source = readFileSync(join(API_DIRECTORY, "drizzle", file), "utf8");
    for (const statement of source.split(
      source.includes("CREATE TRIGGER") ? "--> statement-breakpoint" : ";",
    )) {
      const sql = statement.replace(/--[^\n]*/g, "").trim();
      if (sql) {
        await platform.env.DB.prepare(sql).run();
      }
    }
  }
}, 30000);
afterAll(async () => {
  await platform?.dispose();
});
describe.sequential("開発用商品の初回投入", () => {
  it("会員fixtureだけのテストでは商品を投入せず、通常seedで6商品と在庫を作る", async () => {
    const { catalog: _catalog, ...accessOnly } = DEVELOPMENT_FIXTURE;
    await seedDevelopment(drizzle(platform.env.DB), accessOnly);
    const query = storeReader(platform.env.DB);
    expect((await query.list(StoreListInputDto.parse({ page: { limit: 25 } }))).items).toEqual([]);
    await seedDevelopment(drizzle(platform.env.DB));
    const items = (await query.list(StoreListInputDto.parse({ page: { limit: 25 } }))).items;
    expect(items).toHaveLength(DEVELOPMENT_CATALOG.length);
    expect(items.map((item) => item.sku).toSorted()).toEqual(
      DEVELOPMENT_CATALOG.map((item) => item.sku).toSorted(),
    );
    expect(items.every((item) => item.availableQuantity > 0)).toBe(true);
    expect(items.find((item) => item.sku === "demo-sample")?.unitPrice).toBe(0);
  });
  it("再seedで商品名・価格・画像参照・購入後の在庫を上書きしない", async () => {
    await platform.env.DB.prepare(
      "UPDATE products SET name = '変更後の名前', unit_price = 1999, image_key = 'edited/image' WHERE id = 'demo-product-mug'",
    ).run();
    await platform.env.DB.prepare(
      "INSERT INTO product_images (id,tenant_id,products_id,image_key,state,created_at) VALUES ('edited-image','demo-store','demo-product-mug','edited/image','active','2026-10-11T00:00:00.000Z')",
    ).run();
    await platform.env.DB.prepare(
      "UPDATE inventory_items SET on_hand = 7 WHERE tenant_id = 'demo-store' AND sku = 'demo-mug'",
    ).run();
    await seedDevelopment(drizzle(platform.env.DB));
    await seedDevelopment(drizzle(platform.env.DB));
    expect(
      await platform.env.DB.prepare(
        "SELECT name, unit_price, image_key FROM products WHERE id = 'demo-product-mug'",
      ).first(),
    ).toEqual({ name: "変更後の名前", unit_price: 1999, image_key: "edited/image" });
    expect(
      await platform.env.DB.prepare(
        "SELECT on_hand FROM inventory_items WHERE tenant_id = 'demo-store' AND sku = 'demo-mug'",
      ).first(),
    ).toEqual({ on_hand: 7 });
    expect(
      await storeReader(platform.env.DB).imageKey("demo-store", "demo-mug", "edited-image"),
    ).toBe("edited/image");
    expect(
      (await storeReader(platform.env.DB).list(StoreListInputDto.parse({ page: { limit: 25 } })))
        .items,
    ).toHaveLength(DEVELOPMENT_CATALOG.length);
  });
});

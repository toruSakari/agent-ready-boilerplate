import { StoreListInputDto } from "#api/application/store/dtos/store-list-input-dto.ts";
// @vitest-environment node
import { D1ProductRepository } from "#api/infrastructure/product/repositories/d1-product-repository.ts";
import { orderReader } from "#api/test/order-reader.ts";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import { storeReader } from "#api/test/store-reader.ts";
import { D1OrderRepository } from "#api/infrastructure/order/repositories/d1-order-repository.ts";
import { organizationReader } from "#api/test/organization-reader.ts";
import { OrderEntity } from "#api/domain/order/entities/order.ts";
import { restoreStoredOrderLine } from "#api/infrastructure/order/mappers/restore-stored-order-line.ts";

const API_DIRECTORY = fileURLToPath(new URL("../../../", import.meta.url));
const NOW = "2026-10-11T00:00:00.000Z";
const PAGE_SIZE = 25;
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
  await migrate();
  await seedProducts();
  await seedOrders();
  await seedDraftOrders();
}, 30000);
afterAll(async () => {
  await platform?.dispose();
});

async function migrate() {
  for (const file of readdirSync(join(API_DIRECTORY, "drizzle"))
    .filter((name) => name.endsWith(".sql"))
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
}

async function seedProducts() {
  for (const [id, active, plan] of [
    ["seller-a", 1, "business:demo"],
    ["seller-b", 1, null],
    ["disabled", 0, null],
  ] as const) {
    await platform.env.DB.prepare(
      "INSERT INTO organizations (id,name,active,invitations_enabled,plan_code) VALUES (?,?,?,0,?)",
    )
      .bind(id, `企業${id}`, active, plan)
      .run();
  }

  for (let index = 0; index < 30; index++) {
    const id = `product-${String(index).padStart(2, "0")}`;
    const name = index === 29 ? "needle%_" : "商品";
    await platform.env.DB.prepare(
      "INSERT INTO products (id,tenant_id,sku,name,unit_price,created_at) VALUES (?,'seller-a',?,?,?,?)",
    )
      .bind(id, id, name, index * 100, NOW)
      .run();
    if (index > 0) {
      await platform.env.DB.prepare(
        "INSERT INTO inventory_items (tenant_id,sku,on_hand,updated_at) VALUES ('seller-a',?,?,?)",
      )
        .bind(id, index === 29 ? 0 : index, NOW)
        .run();
    }
  }

  for (const tenant of ["seller-b", "disabled"]) {
    await platform.env.DB.prepare(
      "INSERT INTO products (id,tenant_id,sku,name,unit_price,created_at) VALUES (?,?, 'private', 'needle%_',100,?)",
    )
      .bind(tenant, tenant, NOW)
      .run();
  }
}

async function seedOrders() {
  const repository = new D1OrderRepository(platform.env.DB);
  for (const [id, tenantId, customerId, now, status] of [
    ["matching", "seller-a", "buyer", NOW, "confirmed"],
    ["shipped", "seller-a", "buyer", NOW, "shipped"],
    ["other-buyer", "seller-a", "other", NOW, "confirmed"],
    ["other-seller", "seller-b", "buyer", NOW, "confirmed"],
    ["before", "seller-a", "buyer", "2026-10-10T14:59:59.999Z", "confirmed"],
    ["start", "seller-a", "buyer", "2026-10-10T15:00:00.000Z", "confirmed"],
    ["end", "seller-a", "buyer", "2026-10-11T14:59:59.999Z", "confirmed"],
    ["after", "seller-a", "buyer", "2026-10-11T15:00:00.000Z", "confirmed"],
  ]) {
    await repository.save(
      OrderEntity.place({
        id: id!,
        tenantId: tenantId!,
        customerId: customerId!,
        lines: [
          restoreStoredOrderLine({ sku: "product-01", name: "商品", quantity: 1, unitPrice: 100 }),
        ],
        now: now!,
        eventId: crypto.randomUUID(),
      }),
    );
    if (status !== "confirmed") {
      await platform.env.DB.prepare(
        "UPDATE order_status_assignments SET order_statuses_id=? WHERE orders_id=?",
      )
        .bind(status, id)
        .run();
    }
  }
}

async function seedDraftOrders() {
  const repository = new D1OrderRepository(platform.env.DB);
  for (let index = 0; index < PAGE_SIZE + 1; index++) {
    await repository.save(
      OrderEntity.draft({
        id: `newer-draft-${index}`,
        tenantId: "seller-a",
        customerId: "buyer",
        lines: [
          restoreStoredOrderLine({ sku: "product-01", name: "商品", quantity: 1, unitPrice: 100 }),
        ],
        now: "2026-10-12T00:00:00.000Z",
        eventId: crypto.randomUUID(),
      }),
    );
  }
}

it("後続ページの商品を文字どおり検索し、他企業を返さない", async () => {
  const query = new D1ProductRepository(platform.env.DB);
  expect(
    (await query.list("seller-a", { limit: PAGE_SIZE })).some(
      (product) => product.id === "product-29",
    ),
  ).toBe(false);
  const rows = await query.list("seller-a", { limit: PAGE_SIZE }, { search: "needle%_" });
  expect(rows.map((row) => row.id)).toEqual(["product-29"]);
  expect(await query.list("seller-a", { limit: PAGE_SIZE }, { search: "' OR 1=1 --" })).toEqual([]);
});
it("在庫状態をLIMITより前に適用し、台帳のない商品も在庫切れへ含める", async () => {
  const query = new D1ProductRepository(platform.env.DB);
  const rows = await query.list("seller-a", { limit: PAGE_SIZE }, { stock: "out-of-stock" });
  expect(rows.map((row) => row.id)).toEqual(["product-00", "product-29"]);
  expect(
    await query.list("seller-a", { limit: PAGE_SIZE }, { stock: "in-stock", search: "needle%_" }),
  ).toEqual([]);
});
it("公開商品で在庫と価格の条件を併用し、停止企業の商品を返さない", async () => {
  const query = storeReader(platform.env.DB);
  const rows = await query.list(
    StoreListInputDto.parse({
      page: { limit: PAGE_SIZE },
      search: undefined,
      filters: {
        stock: "in-stock",
        minPrice: 100,
        maxPrice: 200,
      },
    }),
  );
  expect(rows.items.map((row) => row.id)).toEqual(["product-01", "product-02"]);
  const matches = await query.list(
    StoreListInputDto.parse({ page: { limit: PAGE_SIZE }, search: "needle%_" }),
  );
  expect(matches.items.map((row) => row.id).sort()).toEqual(["product-29", "seller-b"]);
});
it("注文状態と番号を併用しても企業・本人のスコープを越えない", async () => {
  const query = orderReader(platform.env.DB);
  expect(
    (await query.list("seller-a", "buyer", { limit: PAGE_SIZE })).some(
      (row) => row.id === "matching",
    ),
  ).toBe(false);
  const rows = await query.list(
    "seller-a",
    "buyer",
    { limit: PAGE_SIZE },
    { status: "confirmed", search: "matching" },
  );
  expect(rows.map((row) => row.id)).toEqual(["matching"]);
  expect(await query.list("seller-a", "buyer", { limit: PAGE_SIZE }, { search: "other" })).toEqual(
    [],
  );
  const store = storeReader(platform.env.DB);
  expect(
    (await store.listOrders("buyer", { limit: PAGE_SIZE }, { status: "shipped" })).items.map(
      (row) => row.id,
    ),
  ).toEqual(["shipped"]);
});
it("注文期間は日本時間の開始を含み、終了翌日の開始を含まない", async () => {
  const query = orderReader(platform.env.DB);
  const rows = await query.list(
    "seller-a",
    "buyer",
    { limit: PAGE_SIZE },
    { from: "2026-10-11", to: "2026-10-11", status: "confirmed" },
  );
  expect(rows.map((row) => row.id).sort()).toEqual(["end", "matching", "start"]);
});
it("古い順でも同時刻IDのカーソルを辿り、境界削除後に重複しない", async () => {
  const query = new D1ProductRepository(platform.env.DB);
  const first = await query.list("seller-a", { limit: 2 }, { sort: "oldest" });
  const cursor = { id: first[1]!.id, createdAt: first[1]!.createdAt };
  const second = await query.list("seller-a", { limit: 2, cursor }, { sort: "oldest" });
  expect(first.map((row) => row.id)).toEqual(["product-00", "product-01"]);
  expect(second.map((row) => row.id)).toEqual(["product-02", "product-03"]);
  await platform.env.DB.prepare("DELETE FROM products WHERE id=?").bind(cursor.id).run();
  expect(
    (await query.list("seller-a", { limit: 2, cursor }, { sort: "oldest" })).map((row) => row.id),
  ).toEqual(["product-02", "product-03"]);
});
it("企業の利用状態・プランをサーバーで絞り、IDカーソルで取得する", async () => {
  const query = organizationReader(platform.env.DB);
  expect(
    (
      await query.list({ status: "active", planCode: "business:demo" }, { limit: PAGE_SIZE })
    ).items.map((row) => row.id),
  ).toEqual(["seller-a"]);
  expect(
    (
      await query.list({ status: "inactive", planCode: "unassigned" }, { limit: PAGE_SIZE })
    ).items.map((row) => row.id),
  ).toEqual(["disabled"]);
  const first = await query.list({}, { limit: 1 });
  expect(first.items[0]?.id).toBe("disabled");
  expect(first.nextId).toBe("disabled");
  expect((await query.list({}, { limit: 1, afterId: first.nextId! })).items[0]?.id).toBe(
    "seller-a",
  );
});

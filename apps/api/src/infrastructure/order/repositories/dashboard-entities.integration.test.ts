import { DashboardVisibilityDto } from "#api/application/dashboard/dtos/dashboard-visibility-dto.ts";
// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { dashboardReader } from "#api/test/dashboard-reader.ts";

const API_DIRECTORY = fileURLToPath(new URL("../../../../", import.meta.url));
const ORDER_COUNT = 151;
let platform: Awaited<
  ReturnType<
    typeof getPlatformProxy<{
      DB: D1Database;
    }>
  >
>;
let query: ReturnType<typeof dashboardReader>;
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
  await migrateDashboardDatabase();

  for (const tenant of ["summary-a", "summary-b"]) {
    await platform.env.DB.prepare(
      "INSERT INTO organizations (id,name,active,invitations_enabled) VALUES (?, ?, 1, 0)",
    )
      .bind(tenant, tenant)
      .run();
    await platform.env.DB.prepare(
      "INSERT INTO products (id,tenant_id,sku,name,unit_price,created_at) VALUES (?, ?, ?, '商品', 0, '2026-10-11T00:00:00.000Z')",
    )
      .bind(tenant, tenant, tenant)
      .run();
  }

  const statements: D1PreparedStatement[] = [];
  for (let index = 0; index < ORDER_COUNT; index++) {
    const id = `summary-${index}`;
    statements.push(
      platform.env.DB.prepare(
        `INSERT INTO orders (id,tenant_id,customer_id,lines,total,created_at) VALUES (?, 'summary-a', 'customer:test', '[{"sku":"free","name":"無料商品","quantity":1,"unitPrice":0}]', 0, '2026-10-11T00:00:00.000Z')`,
      ).bind(id),
    );
    statements.push(
      platform.env.DB.prepare(
        "INSERT INTO order_status_assignments (orders_id,order_statuses_id,updated_at) VALUES (?, ?, '2026-10-11T00:00:00.000Z')",
      ).bind(id, index === 0 ? "confirmed" : "draft"),
    );
  }

  await platform.env.DB.batch(statements);
  query = dashboardReader(platform.env.DB);
}, 30000);
afterAll(async () => {
  await platform?.dispose();
});
describe("企業全件集計", () => {
  it("一覧ページ上限を超える注文も集計し、他企業を混ぜない", async () => {
    expect(
      await query.summary(
        "summary-a",
        DashboardVisibilityDto.parse({ orders: true, products: true, members: true }),
      ),
    ).toEqual({
      ordersTotal: ORDER_COUNT,
      draftCount: ORDER_COUNT - 1,
      confirmedCount: 1,
      productsTotal: 1,
      membersTotal: 0,
    });
    expect(
      await query.summary(
        "summary-b",
        DashboardVisibilityDto.parse({ orders: true, products: true, members: true }),
      ),
    ).toEqual({
      ordersTotal: 0,
      draftCount: 0,
      confirmedCount: 0,
      productsTotal: 1,
      membersTotal: 0,
    });
  });
  it("権限のない領域はゼロ件と区別して公開しない", async () => {
    expect(
      await query.summary(
        "summary-a",
        DashboardVisibilityDto.parse({ orders: false, products: false, members: false }),
      ),
    ).toEqual({
      ordersTotal: null,
      draftCount: null,
      confirmedCount: null,
      productsTotal: null,
      membersTotal: null,
    });
  });
});

async function migrateDashboardDatabase() {
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
}

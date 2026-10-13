// @vitest-environment node
import { D1AccessQuery } from "#api/infrastructure/access/queries/d1-access-query.ts";
import { drizzle } from "drizzle-orm/d1";
import { DEVELOPMENT_FIXTURE } from "@/apps/api/tooling/seeds/development-fixture.ts";
import { seedDevelopment } from "@/apps/api/tooling/seeds/seed-development.ts";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { beforeAll, afterAll, describe, expect, it } from "vite-plus/test";
import { PlanAccessQuery } from "#api/application/access/queries/plan-access-query.ts";
import { DEMO_PLAN_CODES } from "#api/domain/access/policies/plan-catalog.ts";

const API = fileURLToPath(new URL("../apps/api", import.meta.url));
let platform: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;

async function apply(source: string) {
  // trigger内部のセミコロンで文を分断しないよう、該当する移行は専用区切りを使う。
  const separator = source.includes("CREATE TRIGGER") ? "--> statement-breakpoint" : ";";
  const statements = source
    .replace(/--[^\n]*/g, "")
    .split(separator)
    .map((sql) => sql.trim())
    .filter(Boolean);
  await platform.env.DB.batch(statements.map((sql) => platform.env.DB.prepare(sql)));
}

async function rows(sql: string) {
  return (await platform.env.DB.prepare(sql).all()).results;
}

beforeAll(async () => {
  platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath: join(API, "src/infrastructure/access/repositories/wrangler.access-test.jsonc"),
    persist: false,
  });
  for (const file of readdirSync(join(API, "drizzle"))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    await apply(readFileSync(join(API, "drizzle", file), "utf8"));
  }
}, 30_000);
afterAll(async () => {
  await platform?.dispose();
});
// 同じDBでschemaのみ→seed→再seedと進め、移行が業務上の割当を暗黙に作らないことを確認する。
describe.sequential("開発用プランのseed", () => {
  it("schemaとpermissionの定義だけでは会員・企業・ロールへの割当を作らない", assertEmptySchema);
  it("seedでプランと運営の割当権限を直接設定し、企業と個人それぞれで使う", seedAndAssertPlans);
  it(
    "再seedは指定したデモの割当だけを揃え、その他の会員や企業へ権限を与えない",
    assertSeedIsolation,
  );
  it(
    "再実行してもロール変更・企業の停止を巻き戻さず、所属も重複しない",
    assertSeedPreservesOrganizations,
  );
  it("投入途中の制約違反では先に書いた企業やプランの変更も残さない", assertSeedFailureIsAtomic);
  it(
    "退会した一般ユーザーは再登録せず、企業担当者の所属再作成は原子的に拒否する",
    assertSeedLifecycleBoundary,
  );
});

async function assertEmptySchema() {
  expect(await rows("SELECT id FROM organizations")).toEqual([]);
  expect(await rows("SELECT id FROM customer_accounts")).toEqual([]);
  expect(
    await rows("SELECT access_roles_id FROM role_permissions WHERE permissions_id='plan.manage'"),
  ).toEqual([]);
}

async function seedAndAssertPlans() {
  await seedDevelopment(drizzle(platform.env.DB));
  const query = new PlanAccessQuery(new D1AccessQuery(platform.env.DB));
  expect((await query.plan({ category: "business", id: "demo-store" })).code).toBe(
    DEMO_PLAN_CODES.business,
  );
  expect((await query.plan({ category: "customer", id: "customer:demo-customer" })).code).toBe(
    DEMO_PLAN_CODES.customer,
  );
  expect((await query.grant("operator:demo-user", "platform"))?.permissions).toContain(
    "plan.manage",
  );
  expect((await query.grant("business:demo-user", "demo-store"))?.permissions).toContain(
    "order:read",
  );
  expect((await query.grant("customer:demo-customer", "demo-store"))?.permissions).toContain(
    "order:read",
  );
}

async function assertSeedIsolation() {
  await apply(
    "INSERT INTO organizations(id,name,active,invitations_enabled) VALUES('other-organization','対象外',1,0); INSERT INTO customer_accounts(id,subject_id,name,email,deleted) VALUES('customer:other','other-subject','対象外',NULL,0); UPDATE organizations SET plan_code=NULL WHERE id='demo-store'; UPDATE customer_accounts SET plan_code='test-override' WHERE id='customer:demo-customer';",
  );
  await seedDevelopment(drizzle(platform.env.DB));
  await seedDevelopment(drizzle(platform.env.DB));
  const query = new PlanAccessQuery(new D1AccessQuery(platform.env.DB));
  expect((await query.plan({ category: "business", id: "demo-store" })).code).toBe(
    DEMO_PLAN_CODES.business,
  );
  expect((await query.plan({ category: "customer", id: "customer:demo-customer" })).code).toBe(
    DEMO_PLAN_CODES.customer,
  );
  expect(await query.plan({ category: "business", id: "other-organization" })).toEqual({
    code: null,
    permissions: [],
  });
  expect(await query.plan({ category: "customer", id: "customer:other" })).toEqual({
    code: null,
    permissions: [],
  });
}

async function assertSeedPreservesOrganizations() {
  await apply(
    "UPDATE organizations SET name='変更後',active=0,business_ip_restriction_enabled=1,business_allowed_ips='[\"192.0.2.1\"]' WHERE id='demo-store'; UPDATE business_memberships SET access_roles_id='demo-store:staff' WHERE id='business:demo-store:demo-user';",
  );
  await seedDevelopment(drizzle(platform.env.DB));
  expect(
    await rows(
      "SELECT name,active,business_ip_restriction_enabled,business_allowed_ips FROM organizations WHERE id='demo-store'",
    ),
  ).toEqual([
    {
      name: "変更後",
      active: 0,
      business_ip_restriction_enabled: 1,
      business_allowed_ips: '["192.0.2.1"]',
    },
  ]);
  expect(
    await rows(
      "SELECT access_roles_id FROM business_memberships WHERE id='business:demo-store:demo-user'",
    ),
  ).toEqual([{ access_roles_id: "demo-store:staff" }]);
  expect(await rows("SELECT COUNT(*) AS count FROM business_memberships")).toEqual([{ count: 3 }]);
  expect(await rows("SELECT COUNT(*) AS count FROM customer_memberships")).toEqual([{ count: 0 }]);
  expect(await rows("SELECT COUNT(*) AS count FROM role_permissions")).toEqual([{ count: 39 }]);
}

async function assertSeedFailureIsAtomic() {
  await apply("UPDATE organizations SET plan_code='before-failure' WHERE id='demo-store';");
  const fixture = {
    ...DEVELOPMENT_FIXTURE,
    organizations: [
      ...DEVELOPMENT_FIXTURE.organizations,
      { ...DEVELOPMENT_FIXTURE.organizations[0]!, id: "rollback-company" },
    ],
    businessAccounts: [{ ...DEVELOPMENT_FIXTURE.businessAccounts[0]!, id: "invalid-account-id" }],
  };
  await expect(seedDevelopment(drizzle(platform.env.DB), fixture)).rejects.toThrow(
    /CHECK constraint/,
  );
  expect(await rows("SELECT id FROM organizations WHERE id='rollback-company'")).toEqual([]);
  expect(await rows("SELECT plan_code FROM organizations WHERE id='demo-store'")).toEqual([
    { plan_code: "before-failure" },
  ]);
}

async function assertSeedLifecycleBoundary() {
  await apply(
    "DELETE FROM customer_memberships WHERE customer_accounts_id='customer:demo-customer'; UPDATE customer_accounts SET deleted=1,name='退会済み' WHERE id='customer:demo-customer';",
  );
  await seedDevelopment(drizzle(platform.env.DB));
  // 一般ユーザーは所属を作らないためseedが通るが、退会した企業担当者の所属再作成は拒否する。
  await apply(
    "DELETE FROM business_memberships WHERE business_accounts_id='business:demo-member'; UPDATE business_accounts SET deleted=1 WHERE id='business:demo-member';",
  );
  await expect(seedDevelopment(drizzle(platform.env.DB))).rejects.toThrow(
    /membership requires active service account/,
  );
  expect(
    await rows("SELECT name,deleted FROM customer_accounts WHERE id='customer:demo-customer'"),
  ).toEqual([{ name: "退会済み", deleted: 1 }]);
  expect(
    await rows(
      "SELECT id FROM customer_memberships WHERE customer_accounts_id='customer:demo-customer'",
    ),
  ).toEqual([]);
}

import { D1AccessReadRepository } from "#api/infrastructure/access/repositories/d1-access-read-repository.ts";
import { D1AccessQuery } from "#api/infrastructure/access/queries/d1-access-query.ts";
import { D1AccessAuditStore } from "#api/infrastructure/access/stores/d1-access-audit-store.ts";
import { authenticatedAccess as buildAuthenticatedAccess } from "#api/infrastructure/access/repositories/access-control.integration.test-access.ts";

import { seedDevelopment } from "#api-tooling/seeds/seed-development.ts";

import { PlanAccessQuery } from "#api/application/access/queries/plan-access-query.ts";

import { AccessUseCases } from "#api/application/access/use-cases/access-use-cases.ts";

import type { Identity } from "#api/application/auth/contracts/identity.ts";

import { D1AccessRepository } from "#api/infrastructure/access/repositories/d1-access-repository.ts";

import { drizzle } from "drizzle-orm/d1";

import { readFileSync, readdirSync } from "node:fs";

import { join } from "node:path";

import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, beforeEach } from "vite-plus/test";

import { getPlatformProxy } from "wrangler";

export const API_DIRECTORY = fileURLToPath(new URL("../../../../", import.meta.url));

export let platform: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;

export let auditStore: D1AccessAuditStore;
export let repository: D1AccessRepository;
export let reader: D1AccessReadRepository;

export let query: PlanAccessQuery;

export let access: ReturnType<typeof authenticatedAccess>;

export let rawAccess: AccessUseCases;

export const admin: Identity = {
  userId: "operator:demo-user",
  subjectId: "demo-user",
  tenantId: "",
  channel: "admin",
  role: "member",
  email: "demo@example.com",
  permissions: [],
};

export const business: Identity = { ...admin, userId: "business:demo-user", channel: "business" };

export const member: Identity = {
  ...admin,
  channel: "business",
  tenantId: "demo-store",
  userId: "business:demo-member",
  subjectId: "demo-member",
  email: "member@example.com",
};

export async function sql(source: string) {
  for (const statement of source.includes("CREATE TRIGGER")
    ? source.split("--> statement-breakpoint")
    : source.split(";")) {
    const value = statement.replace(/--[^\n]*/g, "").trim();
    if (value) {
      await platform.env.DB.prepare(value).run();
    }
  }
}

beforeAll(async () => {
  platform = await getPlatformProxy<Env>({
    configPath: fileURLToPath(new URL("./wrangler.access-test.jsonc", import.meta.url)),
    persist: false,
  });
  for (const file of readdirSync(join(API_DIRECTORY, "drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await sql(readFileSync(join(API_DIRECTORY, "drizzle", file), "utf8"));
  }

  repository = new D1AccessRepository(platform.env.DB);
  auditStore = new D1AccessAuditStore(platform.env.DB);
  query = new PlanAccessQuery(new D1AccessQuery(platform.env.DB));
  reader = new D1AccessReadRepository(platform.env.DB);
  rawAccess = new AccessUseCases(repository, reader, auditStore);
  access = authenticatedAccess(rawAccess);
}, 30000);

afterAll(async () => {
  await platform?.dispose();
});

beforeEach(async () => {
  const cleanupTables = [
    "access_audit",
    "invitations",
    "customer_memberships",
    "business_memberships",
    "operator_memberships",
    "role_permissions",
    "access_roles",
    "organizations",
    "customer_accounts",
    "business_accounts",
    "operator_accounts",
  ];
  await platform.env.DB.batch(
    cleanupTables.map((table) => platform.env.DB.prepare(`DELETE FROM ${table}`)),
  );
  await platform.env.DB.prepare("UPDATE access_revision SET version=0,mutation_id='initial'").run();
  await seedDevelopment(drizzle(platform.env.DB));
});

export function authenticatedAccess(useCases: AccessUseCases) {
  return buildAuthenticatedAccess(useCases, query, repository);
}

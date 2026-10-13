import { D1AccessReadRepository } from "#api/infrastructure/access/repositories/d1-access-read-repository.ts";
import { D1AccessQuery } from "#api/infrastructure/access/queries/d1-access-query.ts";
import { D1AccessAuditStore } from "#api/infrastructure/access/stores/d1-access-audit-store.ts";
import { authenticatedAccess as buildAuthenticatedAccess } from "#api/infrastructure/access/repositories/plan-permissions.integration.test-access.ts";
import { seedDevelopment } from "#api-tooling/seeds/seed-development.ts";

import { PlanAccessQuery } from "#api/application/access/queries/plan-access-query.ts";

import { AccessUseCases } from "#api/application/access/use-cases/access-use-cases.ts";

import { AccountIdentityProvider } from "#api/application/auth/providers/account-identity-provider.ts";

import type { Identity } from "#api/application/auth/contracts/identity.ts";

import type { ServiceActor } from "#api/application/auth/contracts/service-actor.ts";

import { PlanDefinition } from "#api/domain/access/entities/plan-definition.ts";

import {
  BUSINESS_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";

import type { PlanCategory } from "#api/domain/access/policies/plan-permission-policy.ts";

import { D1AccessRepository } from "#api/infrastructure/access/repositories/d1-access-repository.ts";

import { authenticateActor } from "#api/test/authorized-actor.ts";

import { drizzle } from "drizzle-orm/d1";

import { readFileSync, readdirSync } from "node:fs";

import { join } from "node:path";

import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, beforeEach } from "vite-plus/test";

import { getPlatformProxy } from "wrangler";

export const API_DIRECTORY = fileURLToPath(new URL("../../../../", import.meta.url));

export const PLAN = {
  businessFull: "test:business-full",
  businessRead: "test:business-read",
  businessManage: "test:business-manage",
  businessNoInvite: "test:business-no-invite",
  customerFull: "test:customer-full",
  customerRead: "test:customer-read",
} as const;

export const READ_PERMISSIONS: readonly PermissionCode[] = ["order:read", "product.read"];

export const MANAGEMENT_PERMISSIONS: readonly PermissionCode[] = [
  ...READ_PERMISSIONS,
  "member.read",
  "member.invite",
  "member.assign_role",
  "member.remove",
  "role.manage",
  "audit.read",
];

export const TEST_CATALOG: readonly PlanDefinition[] = [
  PlanDefinition.create({
    code: PLAN.businessFull,
    name: "企業の全権限を検証",
    category: "business",
    permissions: BUSINESS_PERMISSIONS,
  }),
  PlanDefinition.create({
    code: PLAN.businessRead,
    name: "企業の閲覧上限を検証",
    category: "business",
    permissions: READ_PERMISSIONS,
  }),
  PlanDefinition.create({
    code: PLAN.businessManage,
    name: "企業の管理操作を検証",
    category: "business",
    permissions: MANAGEMENT_PERMISSIONS,
  }),
  PlanDefinition.create({
    code: PLAN.businessNoInvite,
    name: "招待権限の失効を検証",
    category: "business",
    permissions: BUSINESS_PERMISSIONS.filter((permission) => permission !== "member.invite"),
  }),
  PlanDefinition.create({
    code: PLAN.customerFull,
    name: "顧客の全権限を検証",
    category: "customer",
    permissions: CUSTOMER_PERMISSIONS,
  }),
  PlanDefinition.create({
    code: PLAN.customerRead,
    name: "顧客の閲覧上限を検証",
    category: "customer",
    permissions: READ_PERMISSIONS,
  }),
];

export const admin: Identity = {
  userId: "operator:demo-user",
  subjectId: "demo-user",
  tenantId: "",
  channel: "admin",
  role: "member",
  email: "demo@example.com",
  permissions: [],
};

export const business: Identity = {
  ...admin,
  userId: "business:demo-user",
  tenantId: "demo-store",
  channel: "business",
};

export const customer: Identity = {
  ...admin,
  userId: "customer:demo-user",
  tenantId: "demo-store",
  channel: "customer",
};

export const member: Identity = {
  ...business,
  userId: "business:demo-member",
  subjectId: "demo-member",
  email: "member@example.com",
};

export let platform: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;

export let auditStore: D1AccessAuditStore;
export let repository: D1AccessRepository;

export let query: PlanAccessQuery;

export let rawAccess: AccessUseCases;

export let access: ReturnType<typeof authenticatedAccess>;

export async function authenticate(fixture: Identity, purpose?: ServiceActor["purpose"]) {
  const provider = new AccountIdentityProvider({ authenticate: async () => fixture }, query);
  const identity = await authenticateActor(
    provider,
    new Request("http://localhost/api/trpc", {
      headers: { "x-organization-id": fixture.tenantId },
    }),
    {
      service: fixture.channel === "admin" ? "operator" : (fixture.channel ?? "business"),
      purpose,
    },
  );
  return { provider, identity };
}

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

export async function setPlan(category: PlanCategory, id: string, planCode: string | null) {
  const table = category === "business" ? "organizations" : "customer_accounts";
  await platform.env.DB.prepare(`UPDATE ${table} SET plan_code=? WHERE id=?`)
    .bind(planCode, id)
    .run();
}

export async function addRolePermission(roleId: string, permission: PermissionCode) {
  await platform.env.DB.prepare(
    "INSERT INTO role_permissions (id,access_roles_id,permissions_id) VALUES (?,?,?)",
  )
    .bind(`${roleId}:${permission}`, roleId, permission)
    .run();
}

export async function defineRole(id: string, permissions: readonly PermissionCode[]) {
  await platform.env.DB.prepare(
    "INSERT INTO access_roles (id,scope,name,protected_role) VALUES (?,'demo-store',?,0)",
  )
    .bind(id, id)
    .run();
  for (const permission of permissions) {
    await addRolePermission(id, permission);
  }
}

export function assignmentAudit(id: string, targetId = "demo-store") {
  return {
    id,
    actorId: admin.userId,
    scope: "platform",
    action: "plan.assign",
    targetId,
    occurredAt: new Date().toISOString(),
  };
}

beforeAll(async () => {
  platform = await getPlatformProxy<Env>({
    configPath: fileURLToPath(new URL("./wrangler.access-test.jsonc", import.meta.url)),
    persist: false,
  });
  for (const file of readdirSync(join(API_DIRECTORY, "drizzle"))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    await sql(readFileSync(join(API_DIRECTORY, "drizzle", file), "utf8"));
  }

  repository = new D1AccessRepository(platform.env.DB);
  auditStore = new D1AccessAuditStore(platform.env.DB);
  query = new PlanAccessQuery(new D1AccessQuery(platform.env.DB), TEST_CATALOG);
  rawAccess = new AccessUseCases(
    repository,
    new D1AccessReadRepository(platform.env.DB, TEST_CATALOG),
    auditStore,
  );
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
  // テストの割当はすべて明示する。新規登録行は意図どおりNULLのままにする。
  await setPlan("business", "demo-store", PLAN.businessFull);
  await setPlan("business", "demo-second", PLAN.businessRead);
  await setPlan("customer", "customer:demo-user", PLAN.customerFull);
  await setPlan("customer", "customer:demo-customer", PLAN.customerRead);
});

export function authenticatedAccess(useCases: AccessUseCases) {
  return buildAuthenticatedAccess(useCases, query, repository);
}

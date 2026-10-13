import type { ServiceActor } from "#api/application/auth/contracts/service-actor.ts";
import { D1AccessReadRepository } from "#api/infrastructure/access/repositories/d1-access-read-repository.ts";
import { D1AccessQuery } from "#api/infrastructure/access/queries/d1-access-query.ts";
import { D1AccessAuditStore } from "#api/infrastructure/access/stores/d1-access-audit-store.ts";
import { authenticatedAccess as buildAuthenticatedAccess } from "#api/infrastructure/auth/providers/service-account-lifecycles.integration.test-access.ts";
import { drizzle } from "drizzle-orm/d1";
import { seedDevelopment } from "#api-tooling/seeds/seed-development.ts";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach } from "vite-plus/test";
import { getPlatformProxy } from "wrangler";
import { PlanAccessQuery } from "#api/application/access/queries/plan-access-query.ts";
import { AccessUseCases } from "#api/application/access/use-cases/access-use-cases.ts";
import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";
import { D1AccessRepository } from "#api/infrastructure/access/repositories/d1-access-repository.ts";
import { AccountIdentityProvider } from "#api/application/auth/providers/account-identity-provider.ts";
import { authenticateActor } from "#api/test/authorized-actor.ts";
import { DemoIdentityProvider } from "#api/infrastructure/auth/providers/demo-identity-provider.ts";
import { hashInvitation } from "#api/application/access/shared/invitation-token.ts";

export const API_DIRECTORY = fileURLToPath(new URL("../../../../", import.meta.url));
export const INTEGRATION_STARTUP_TIMEOUT_MS = 30000;
export const CHANNEL_SERVICES = {
  admin: "operator",
  business: "business",
  customer: "customer",
} as const;
export const AUDIT_TIMES = {
  issued: "2026-01-01T00:00:00.000Z",
  removed: "2026-01-01T00:01:00.000Z",
  reissued: "2026-01-01T00:02:00.000Z",
};

export type Channel = keyof typeof CHANNEL_SERVICES;

export let platform: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
export let auditStore: D1AccessAuditStore;
export let repository: D1AccessRepository;
export let reader: D1AccessReadRepository;
export let query: PlanAccessQuery;
export let access: ReturnType<typeof authenticatedAccess>;
export let rawAccess: AccessUseCases;
export let provider: AccountIdentityProvider;

export async function sql(source: string) {
  // トリガー本体のセミコロンを分断しないよう、0014の明示的な区切りを尊重する。
  const statements = source.includes("CREATE TRIGGER")
    ? source.split("--> statement-breakpoint")
    : source.split(";");
  for (const statement of statements) {
    const value = statement.replace(/--[^\n]*/g, "").trim();
    if (value) {
      await platform.env.DB.prepare(value).run();
    }
  }
}

export function authenticate(
  subjectId: string,
  channel: Channel,
  scope?: string,
  procedure = "access.session",
  email?: string,
) {
  const headers = new Headers({ "x-demo-user": subjectId });
  if (scope !== undefined) {
    headers.set("x-organization-id", scope);
  }

  if (email) {
    headers.set("x-demo-email", email);
  }

  const purposes: Readonly<Record<string, ServiceActor["purpose"]>> = {
    "access.registration": "registration",
    "access.registerCustomer": "registration",
    "access.acceptInvitation": "invitation",
    "access.withdraw": "withdrawal",
  };
  return authenticateActor(
    provider,
    new Request(`http://localhost/api/trpc/${procedure}`, { headers }),
    {
      service: CHANNEL_SERVICES[channel],
      purpose: purposes[procedure],
    },
  );
}

export const operator = () => authenticate("demo-user", "admin");
export const channelFor = (category: AccountCategoryCode): Channel =>
  category === "operator" ? "admin" : category;

export async function account(subjectId: string, category: AccountCategoryCode) {
  return platform.env.DB.prepare(
    `SELECT * FROM ${category}_accounts WHERE subject_id=? AND deleted=0`,
  )
    .bind(subjectId)
    .first();
}

export async function memberships(userId: string, category: AccountCategoryCode) {
  return (
    await platform.env.DB.prepare(
      `SELECT id,${category === "operator" ? "scope" : "organizations_id"} AS scope,${category}_accounts_id,access_roles_id FROM ${category}_memberships WHERE ${category}_accounts_id=? ORDER BY scope`,
    )
      .bind(userId)
      .all()
  ).results;
}

export async function invitation(token: string) {
  return repository.findInvitation(await hashInvitation(token));
}

export async function setIssuedAt(token: string, timestamp: string) {
  const stored = await invitation(token);
  if (!stored) {
    throw new Error("テスト用の招待がありません");
  }

  await platform.env.DB.prepare(
    "UPDATE access_audit SET occurred_at=? WHERE action='member.invite' AND target_id=?",
  )
    .bind(timestamp, stored.id)
    .run();
}

export async function addAccount(
  subjectId: string,
  category: AccountCategoryCode,
  email = `${subjectId}@example.com`,
) {
  const id = `${category}:${crypto.randomUUID()}`;
  await platform.env.DB.prepare(
    `INSERT INTO ${category}_accounts(id,subject_id,name,email,deleted) VALUES(?,?,?,?,0)`,
  )
    .bind(id, subjectId, "テスト会員", email)
    .run();
  return id;
}

export async function addMembership(
  userId: string,
  category: AccountCategoryCode,
  scope: string,
  roleId: string,
) {
  const id = `${category}:${crypto.randomUUID()}`;
  await platform.env.DB.prepare(
    `INSERT INTO ${category}_memberships(id,${category === "operator" ? "scope" : "organizations_id"},${category}_accounts_id,access_roles_id) VALUES(?,?,?,?)`,
  )
    .bind(id, scope, userId, roleId)
    .run();
  return id;
}

export async function register(subjectId: string, email = `${subjectId}@example.com`) {
  const identity = await authenticate(
    subjectId,
    "customer",
    undefined,
    "access.registerCustomer",
    email,
  );
  await access.registerCustomer(identity, { name: "登録した顧客" });
  return authenticate(subjectId, "customer");
}

export async function inviteAndAccept(
  subjectId: string,
  category: AccountCategoryCode,
  scope = "demo-store",
  email = `${subjectId}@example.com`,
) {
  const roleId =
    category === "operator"
      ? "platform:assistant"
      : `${scope}:${category === "customer" ? "customer" : "staff"}`;
  const issued = await access.invite(await operator(), {
    scope,
    email,
    roleId,
    actorKind: category,
  });
  const identity = await authenticate(
    subjectId,
    channelFor(category),
    undefined,
    "access.acceptInvitation",
    email,
  );
  await access.acceptInvitation(identity, { token: issued.token, name: "招待された会員" });
  return authenticate(subjectId, channelFor(category));
}

beforeAll(async () => {
  platform = await getPlatformProxy<Env>({
    configPath: fileURLToPath(
      new URL("../../access/repositories/wrangler.access-test.jsonc", import.meta.url),
    ),
    persist: false,
  });
  for (const file of readdirSync(join(API_DIRECTORY, "drizzle"))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    await sql(readFileSync(join(API_DIRECTORY, "drizzle", file), "utf8"));
  }

  repository = new D1AccessRepository(platform.env.DB);
  auditStore = new D1AccessAuditStore(platform.env.DB);
  query = new PlanAccessQuery(new D1AccessQuery(platform.env.DB));
  reader = new D1AccessReadRepository(platform.env.DB);
  rawAccess = new AccessUseCases(repository, reader, auditStore);
  access = authenticatedAccess(rawAccess);
  provider = new AccountIdentityProvider(new DemoIdentityProvider(), query);
}, INTEGRATION_STARTUP_TIMEOUT_MS);
afterAll(async () => {
  await platform?.dispose();
});
beforeEach(async () => {
  const cleanupTables = [
    "order_status_assignments",
    "orders",
    "outbox_events",
    "order_event_history",
    "payments",
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
export const verifiedEmail = "changed-member@example.com";
export const changedIdentity = () =>
  authenticate("demo-member", "business", undefined, "access.acceptInvitation", verifiedEmail);

export async function changedInvitation(scope = "demo-store") {
  return await access.invite(await operator(), {
    scope,
    email: verifiedEmail,
    roleId: `${scope}:staff`,
    actorKind: "business",
  });
}

export async function removeMember() {
  await access.removeMember(await operator(), {
    scope: "demo-store",
    membershipId: "business:demo-store:demo-member",
  });
  await platform.env.DB.prepare(
    "UPDATE access_audit SET occurred_at=? WHERE action='member.remove' AND target_id='business:demo-member' AND scope='demo-store'",
  )
    .bind(AUDIT_TIMES.removed)
    .run();
}

export function authenticatedAccess(useCases: AccessUseCases) {
  return buildAuthenticatedAccess(useCases, query, repository);
}

/** 前進移行前の残存招待を再現し、公開操作では一般ユーザーへ発行しない。 */
export async function legacyCustomerInvitation(email: string) {
  const token = crypto.randomUUID();
  const id = crypto.randomUUID();
  await platform.env.DB.prepare(
    "INSERT INTO invitations (id,scope,email,access_roles_id,token_hash,expires_at,inviter_id,actor_kind,inviter_channel) VALUES (?, 'demo-second', ?, 'demo-second:staff', ?, ?, 'operator:demo-user', 'customer', 'admin')",
  )
    .bind(id, email, await hashInvitation(token), "2099-01-01T00:00:00.000Z")
    .run();
  return { id, token };
}

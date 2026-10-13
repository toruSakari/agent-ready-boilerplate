// @vitest-environment node
import {
  access,
  admin,
  business,
  repository,
  query,
  auditStore,
  platform,
  sql,
} from "#api/infrastructure/access/repositories/access-control.integration.test-fixture.ts";
import { readFileSync } from "node:fs";
import { expect, it } from "vite-plus/test";

const scope = "demo-store";
const businessActor = { ...business, tenantId: scope };
const customerMembership = "customer:demo-store:demo-customer";

it("企業のメンバー一覧は企業担当者だけを返し、一般会員の氏名・メール・IDを返さない", async () => {
  const members = await access.listMembers(businessActor, scope);
  expect(members.map((member) => member.userId).sort()).toEqual([
    "business:demo-member",
    "business:demo-user",
  ]);
  expect(members.every((member) => member.category === "business")).toBe(true);
  const response = JSON.stringify(members);
  for (const privateValue of [
    "デモ一般ユーザー",
    "customer@example.com",
    "customer:demo-user",
    "customer:demo-customer",
  ]) {
    expect(response).not.toContain(privateValue);
  }
});

it.each(["assignRole", "removeMember"] as const)(
  "企業は顧客の所属IDを直接指定しても%sできず、状態と監査を変更しない",
  async (operation) => {
    const before = await repository.load(scope);
    await expect(
      access[operation](businessActor, {
        scope,
        membershipId: customerMembership,
        roleId: "demo-store:customer",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await repository.load(scope)).toEqual(before);
    expect(await query.audit(scope)).toEqual([]);
  },
);

it("企業は顧客サービスへの招待を発行できない", async () => {
  await expect(
    access.invite(businessActor, {
      scope,
      email: "customer@example.com",
      roleId: "demo-store:customer",
      actorKind: "customer",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect((await repository.load(scope)).invitations).toEqual([]);
  expect(await query.audit(scope)).toEqual([]);
});

it("一般ユーザーは企業の招待を受けられず、登録だけで企業所属を作らない", async () => {
  const before = await repository.load(scope);
  await expect(
    access.acceptInvitation(
      {
        ...business,
        channel: "customer",
        userId: "customer:demo-customer",
        subjectId: "demo-customer",
        email: "customer@example.com",
      },
      { token: "legacy-customer-token", name: "一般ユーザー" },
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(await repository.load(scope)).toEqual(before);
  expect(await platform.env.DB.prepare("SELECT id FROM customer_memberships").all()).toMatchObject({
    results: [],
  });
});

it("運営の全ユーザー管理は個人情報権限で保護され、企業所属を表示しない", async () => {
  const users = await access.listUsers(admin);
  expect(users).toContainEqual(
    expect.objectContaining({
      id: "customer:demo-customer",
      category: "customer",
      email: "customer@example.com",
      memberships: [],
    }),
  );
  expect(await query.audit("platform")).toContainEqual(
    expect.objectContaining({
      actorId: "operator:demo-user",
      action: "user.personal.read",
    }),
  );
  expect(
    (await access.listMembers(admin, scope)).every((member) => member.category === "business"),
  ).toBe(true);
});

it("旧ポータルの一般ユーザー所属はDBに残っていても企業の管理・認証へ混入しない", async () => {
  await sql(
    "INSERT INTO customer_memberships(id,organizations_id,customer_accounts_id,access_roles_id) VALUES('customer:legacy-member','demo-store','customer:demo-customer','demo-store:owner')",
  );
  expect((await repository.load(scope)).customerAccounts).toEqual([]);
  expect(
    (await repository.load(scope)).memberships.every((member) => member.category === "business"),
  ).toBe(true);
  expect(
    (await access.listMembers(businessActor, scope)).every(
      (member) => member.category === "business",
    ),
  ).toBe(true);
  await expect(
    access.removeMember(businessActor, { scope, membershipId: "customer:legacy-member" }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(
    (
      await access.session({
        ...businessActor,
        channel: "customer",
        userId: "customer:demo-customer",
        subjectId: "demo-customer",
      })
    ).organizations,
  ).toEqual([]);
});

it("移行0019は旧所属を解消して会員・企業担当者・監査を保持する", async () => {
  await sql(
    "INSERT INTO customer_memberships(id,organizations_id,customer_accounts_id,access_roles_id) VALUES('customer:legacy-member','demo-store','customer:demo-customer','demo-store:staff')",
  );
  await auditStore.appendAudit({
    id: "historical-audit",
    actorId: "customer:demo-customer",
    scope,
    action: "account.register",
    targetId: "customer:demo-customer",
    occurredAt: "2026-01-01T00:00:00.000Z",
  });
  const before = await repository.load("platform");
  const migration = readFileSync(
    new URL("../../../../drizzle/0019_ordinary_users_without_memberships.sql", import.meta.url),
    "utf8",
  );
  await sql(migration);
  const after = await repository.load("platform");
  expect(after.customerAccounts).toEqual(before.customerAccounts);
  expect(after.businessAccounts).toEqual(before.businessAccounts);
  expect(after.memberships).toEqual(before.memberships);
  expect(await platform.env.DB.prepare("SELECT id FROM customer_memberships").all()).toMatchObject({
    results: [],
  });
  expect(await query.audit(scope)).toContainEqual(
    expect.objectContaining({ id: "historical-audit" }),
  );
});

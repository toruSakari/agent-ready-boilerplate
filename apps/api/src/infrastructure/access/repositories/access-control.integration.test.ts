import { AccessDirectoryAuditInputDto } from "#api/application/access/dtos/access-directory-audit-input-dto.ts";
// @vitest-environment node
import {
  platform,
  repository,
  reader,
  auditStore,
  query,
  access,
  rawAccess,
  admin,
  business,
  member,
} from "#api/infrastructure/access/repositories/access-control.integration.test-fixture.ts";
import { hashInvitation } from "#api/application/access/shared/invitation-token.ts";
import { AccountIdentityProvider } from "#api/application/auth/providers/account-identity-provider.ts";
import { prepareAuthorizedActor } from "#api/application/auth/policies/prepare-authorized-actor.ts";
import { PLATFORM_PERMISSIONS } from "#api/domain/access/policies/permission-catalog.ts";
import { DemoIdentityProvider } from "#api/infrastructure/auth/providers/demo-identity-provider.ts";
import { authenticateActor } from "#api/test/authorized-actor.ts";
import { expect, it, vi } from "vite-plus/test";

it.each([{ required: [] }, { required: PLATFORM_PERMISSIONS }] as const)(
  "企業・権限管理のDB境界 / 自己申告のIdentityは権限要求$requiredでも認可境界で拒否する",
  async (props) => {
    const provider = new AccountIdentityProvider(new DemoIdentityProvider(), query);
    const load = vi.spyOn(repository, "load");
    const commit = vi.spyOn(repository, "commit");
    const audit = vi.spyOn(auditStore, "appendAudit");
    try {
      await expect(
        prepareAuthorizedActor(
          provider,
          { ...admin, role: "admin", permissions: PLATFORM_PERMISSIONS },
          props.required,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(load).not.toHaveBeenCalled();
      expect(commit).not.toHaveBeenCalled();
      expect(audit).not.toHaveBeenCalled();
    } finally {
      load.mockRestore();
      commit.mockRestore();
      audit.mockRestore();
    }
  },
);
it("企業・権限管理のDB境界 / 本人確認済みでもサービス会員未解決のIdentityは認可境界で拒否する", async () => {
  const provider = new AccountIdentityProvider(new DemoIdentityProvider(), query);
  const identity = await provider.authenticate(new Request("http://localhost/api/trpc"));
  await expect(prepareAuthorizedActor(provider, identity, ["user.read"])).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(await query.audit("platform")).toEqual([]);
});
it("企業・権限管理のDB境界 / 認可済み監査の企業と異なる企業への問い合わせを拒否する", async () => {
  const provider = new AccountIdentityProvider(new DemoIdentityProvider(), query);
  const identity = await authenticateActor(
    provider,
    new Request("http://localhost/api/trpc", {
      headers: { "x-demo-user": "demo-user", "x-organization-id": "demo-store" },
    }),
    { service: "business" },
  );
  const state = await repository.load("demo-store");
  const actor = await prepareAuthorizedActor(provider, identity, ["audit.read"], {
    scope: "demo-store",
    state,
  });
  const audit = vi.spyOn(reader, "audit");
  try {
    await expect(
      rawAccess
        .audit(AccessDirectoryAuditInputDto.parse({ identity: actor, scope: "demo-second" }))
        .then((result) => result.items),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(audit).not.toHaveBeenCalled();
  } finally {
    audit.mockRestore();
  }
});
it("企業・権限管理のDB境界 / 複数企業への所属と企業別ロールを取得する", async () => {
  const session = await access.session(business);
  expect(session.organizations.map((o) => o.id)).toEqual(["demo-store", "demo-second"]);
  expect(session.platformPermissions).toEqual([]);
  expect((await access.session(admin)).platformPermissions).toContain("user.delete");
  const state = await repository.load("demo-store");
  expect(state.memberships.every((m) => m.scope === "demo-store")).toBe(true);
  expect(
    [...state.customerAccounts, ...state.businessAccounts, ...state.operatorAccounts].every(
      (account) => Object.isFrozen(account),
    ),
  ).toBe(true);
  expect(Object.isFrozen(state.roles[0]?.permissions)).toBe(true);
});
it("企業・権限管理のDB境界 / 未所属の企業を選んだ認証を403で拒否する", async () => {
  const provider = new AccountIdentityProvider(new DemoIdentityProvider(), query);
  await expect(
    authenticateActor(
      provider,
      new Request("http://localhost/api/trpc", {
        headers: { "x-demo-user": "demo-member", "x-organization-id": "demo-second" },
      }),
      { service: "business" },
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const identity = await authenticateActor(
    provider,
    new Request("http://localhost/api/trpc", {
      headers: {
        "x-demo-user": "demo-member",
        "x-demo-role": "admin",
        "x-organization-id": "demo-store",
      },
    }),
    { service: "business" },
  );
  expect(identity.permissions).not.toContain("product.update");
});
it("企業・権限管理のDB境界 / 権限のないユーザーは企業作成・全ユーザー閲覧をできない", async () => {
  await expect(access.createOrganization(member, { name: "拒否" })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(access.listUsers(member)).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(await query.audit("platform")).toEqual([]);
});
it("企業・権限管理のDB境界 / 企業作成時に初期ロールを保存して監査する", async () => {
  const { id } = await access.createOrganization(admin, { name: "新企業" });
  const state = await repository.load(id);
  expect(state.organizations[0]?.invitationsEnabled).toBe(false);
  expect(state.roles.map((r) => r.name)).toEqual(
    expect.arrayContaining(["オーナー", "管理者", "スタッフ"]),
  );
  expect((await query.audit("platform"))[0]?.action).toBe("organization.create");
});
it("企業・権限管理のDB境界 / 個人情報権限がない運営ユーザーには企業メンバーのメールも返さない", async () => {
  await platform.env.DB.prepare(
    "INSERT INTO operator_accounts (id,subject_id,name,email,deleted) VALUES ('operator:demo-member','demo-member','閲覧運営','member@example.com',0)",
  ).run();
  await platform.env.DB.prepare(
    "INSERT INTO operator_memberships (id,scope,operator_accounts_id,access_roles_id) VALUES ('operator:assistant','platform','operator:demo-member','platform:assistant')",
  ).run();
  const operator = { ...member, userId: "operator:demo-member", channel: "admin" as const };
  const users = await access.listUsers(operator);
  expect(users.every((u) => u.email === null)).toBe(true);
  const members = await access.listMembers(operator, "demo-store");
  expect(members.every((u) => u.email === null)).toBe(true);
});
it("企業・権限管理のDB境界 / 企業側の招待を運営が無効にできる", async () => {
  await platform.env.DB.prepare("DELETE FROM operator_memberships WHERE scope='platform'").run();
  await platform.env.DB.prepare(
    "UPDATE organizations SET invitations_enabled=0 WHERE id='demo-store'",
  ).run();
  await expect(
    access.invite(
      { ...business, tenantId: "demo-store" },
      {
        scope: "demo-store",
        email: "new@example.com",
        roleId: "demo-store:staff",
        actorKind: "business",
      },
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("企業・権限管理のDB境界 / 別企業のロールを割り当てられない", async () => {
  await expect(
    access.assignRole(admin, {
      scope: "demo-store",
      membershipId: "business:demo-store:demo-member",
      roleId: "demo-second:owner",
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("企業・権限管理のDB境界 / 企業への所属がないユーザーは別企業のメンバーを閲覧できない", async () => {
  await expect(access.listMembers(member, "demo-second")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
it("企業・権限管理のDB境界 / 自分の権限を超えたカスタムロール作成を拒否する", async () => {
  await platform.env.DB.prepare(
    "INSERT INTO role_permissions (id,access_roles_id,permissions_id) VALUES ('staff-role-manage','demo-store:staff','role.manage')",
  ).run();
  await expect(
    access.saveRole(member, {
      scope: "demo-store",
      name: "昇格",
      permissions: ["member.invite"],
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const role = await access.saveRole(member, {
    scope: "demo-store",
    name: "閲覧",
    permissions: ["order:read"],
  });
  expect(role.id).toBeTruthy();
});
it("企業・権限管理のDB境界 / 企業ロールに運営用パーミッションを追加できない", async () => {
  await expect(
    access.saveRole(admin, { scope: "demo-store", name: "運営", permissions: ["user.delete"] }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("企業・権限管理のDB境界 / 最後のオーナーの所属解除・降格を拒否する", async () => {
  await expect(
    access.removeMember(admin, {
      scope: "demo-store",
      membershipId: "business:demo-store:demo-user",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(
    access.assignRole(admin, {
      scope: "demo-store",
      membershipId: "business:demo-store:demo-user",
      roleId: "demo-store:staff",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(
    access.removeMember(admin, {
      scope: "platform",
      membershipId: "operator:platform:demo-user",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});
it("企業・権限管理のDB境界 / 所属解除は他企業への所属を維持する", async () => {
  await platform.env.DB.prepare(
    "INSERT INTO business_memberships (id,organizations_id,business_accounts_id,access_roles_id) VALUES ('business:second-member','demo-second','business:demo-member','demo-second:staff')",
  ).run();
  await access.removeMember(admin, {
    scope: "demo-store",
    membershipId: "business:demo-store:demo-member",
  });
  expect(
    (await access.session({ ...member, tenantId: "" })).organizations.map((o) => o.id),
  ).toEqual(["demo-second"]);
});
it("企業・権限管理のDB境界 / 対象会員の削除はその種別の全所属を解除し個人情報を匿名化する", async () => {
  await access.deleteUser(admin, "business:demo-member");
  expect(await query.grant("business:demo-member", "demo-store")).toBeNull();
  expect((await access.listUsers(admin)).some((u) => u.id === "business:demo-member")).toBe(false);
  const stored = await platform.env.DB.prepare(
    "SELECT * FROM business_accounts WHERE id='business:demo-member'",
  ).first();
  expect(stored).toMatchObject({ deleted: 1, email: null, name: "削除済みユーザー" });
  expect((await query.audit("platform")).some((a) => a.action === "account.delete")).toBe(true);
});
it("企業・権限管理のDB境界 / 最後のオーナーを含むアカウントは削除できない", async () => {
  await expect(access.deleteUser(admin, "business:demo-user")).rejects.toMatchObject({
    code: "CONFLICT",
  });
});
it("企業・権限管理のDB境界 / 本人のメールでのみ招待を承諾し、トークンを再利用できない", async () => {
  const result = await access.invite(admin, {
    scope: "demo-second",
    email: "new@example.com",
    roleId: "demo-second:staff",
    actorKind: "business",
  });
  expect(await repository.findInvitation(result.token)).toBeNull();
  expect(await repository.findInvitation(await hashInvitation(result.token))).toBeTruthy();
  await expect(
    access.acceptInvitation(member, { token: result.token, name: "新ユーザー" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const user = {
    ...member,
    tenantId: "",
    userId: "",
    subjectId: "new-user",
    email: "new@example.com",
  };
  await access.acceptInvitation(user, { token: result.token, name: "新ユーザー" });
  const provider = new AccountIdentityProvider(new DemoIdentityProvider(), query);
  const enrolled = await authenticateActor(
    provider,
    new Request("http://localhost/api/trpc/access.session", {
      headers: { "x-demo-user": "new-user" },
    }),
    { service: "business" },
  );
  expect((await access.session(enrolled)).organizations.map((o) => o.id)).toEqual(["demo-second"]);
  await expect(
    access.acceptInvitation(user, { token: result.token, name: "新ユーザー" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
it("企業・権限管理のDB境界 / 既存アカウントへの招待は同じIDの所属を増やす", async () => {
  const result = await access.invite(admin, {
    scope: "demo-second",
    email: "member@example.com",
    roleId: "demo-second:staff",
    actorKind: "business",
  });
  await access.acceptInvitation(member, { token: result.token, name: "別名" });
  expect((await access.session(member)).organizations).toHaveLength(2);
  expect((await access.listUsers(admin)).find((a) => a.id === "business:demo-member")?.name).toBe(
    "デモ閲覧担当",
  );
});
it("企業・権限管理のDB境界 / 期限切れの招待を拒否する", async () => {
  const result = await access.invite(admin, {
    scope: "demo-second",
    email: "new@example.com",
    roleId: "demo-second:staff",
    actorKind: "business",
  });
  await platform.env.DB.prepare(
    "UPDATE invitations SET expires_at='2020-01-01T00:00:00.000Z'",
  ).run();
  await expect(
    access.acceptInvitation(
      { ...member, email: "new@example.com" },
      { token: result.token, name: "名前" },
    ),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
it("企業・権限管理のDB境界 / 招待発行者の権限が失われた場合、未承諾の招待を拒否する", async () => {
  const result = await access.invite(admin, {
    scope: "demo-second",
    email: "new@example.com",
    roleId: "demo-second:staff",
    actorKind: "business",
  });
  await platform.env.DB.prepare(
    "DELETE FROM operator_memberships WHERE operator_accounts_id='operator:demo-user'",
  ).run();
  await expect(
    access.acceptInvitation(
      { ...member, userId: "", subjectId: "new", email: "new@example.com" },
      { token: result.token, name: "名前" },
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("企業・権限管理のDB境界 / 企業の停止は認証と未承諾の招待に即時反映される", async () => {
  const result = await access.invite(admin, {
    scope: "demo-second",
    email: "new@example.com",
    roleId: "demo-second:staff",
    actorKind: "business",
  });
  await access.updateOrganization(admin, {
    id: "demo-second",
    name: "デモ企業B",
    active: false,
    invitationsEnabled: true,
  });
  expect(await query.grant("business:demo-user", "demo-second")).toBeNull();
  await expect(
    access.acceptInvitation(
      { ...member, userId: "", subjectId: "new", email: "new@example.com" },
      { token: result.token, name: "名前" },
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

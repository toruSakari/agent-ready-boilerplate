import { PlanAssignment } from "#api/domain/access/entities/plan-assignment.ts";
// @vitest-environment node
import {
  PLAN,
  READ_PERMISSIONS,
  MANAGEMENT_PERMISSIONS,
  admin,
  business,
  customer,
  member,
  repository,
  auditStore,
  query,
  access,
  setPlan,
  addRolePermission,
  defineRole,
  assignmentAudit,
} from "#api/infrastructure/access/repositories/plan-permissions.integration.test-fixture.ts";
import { hashInvitation } from "#api/application/access/shared/invitation-token.ts";
import { PLATFORM_PERMISSIONS } from "#api/domain/access/policies/permission-catalog.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { expect, it } from "vite-plus/test";

it("プラン割当の認可と原子性 / 監査保存が失敗すればプラン変更と版更新もロールバックする", async () => {
  await auditStore.appendAudit(assignmentAudit("duplicate-audit"));
  const state = await repository.load("platform");
  await expect(
    repository.commit(
      state.version,
      {
        planAssignments: [
          new PlanAssignment(
            "business",
            AccessId.create("demo-store"),
            AccessId.create(PLAN.businessRead),
          ),
        ],
      },
      assignmentAudit("duplicate-audit"),
    ),
  ).rejects.toThrow();
  expect((await query.plan({ category: "business", id: "demo-store" })).code).toBe(
    PLAN.businessFull,
  );
  expect((await repository.load("platform")).version).toBe(state.version);
  expect(await query.audit("platform")).toHaveLength(1);
});

it("ロール編集・委譲・招待でのプラン上限 / ロール編集候補は所有企業のプランと操作担当者の権限に限定する", async () => {
  await setPlan("business", "demo-store", PLAN.businessManage);
  const ownerCatalog = await access.rolePermissionCatalog(business, "demo-store");
  const operatorCatalog = await access.rolePermissionCatalog(admin, "demo-store");
  expect(Object.keys(ownerCatalog).toSorted()).toEqual(MANAGEMENT_PERMISSIONS.toSorted());
  expect(Object.keys(operatorCatalog).toSorted()).toEqual(MANAGEMENT_PERMISSIONS.toSorted());
  expect(Object.keys(await access.rolePermissionCatalog(admin, "platform")).toSorted()).toEqual(
    PLATFORM_PERMISSIONS.toSorted(),
  );
});

it("ロール編集・委譲・招待でのプラン上限 / ロール候補の取得にはrole.manageの現在権限が必要である", async () => {
  await expect(access.rolePermissionCatalog(member, "demo-store")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await setPlan("business", "demo-store", PLAN.businessRead);
  await expect(access.rolePermissionCatalog(business, "demo-store")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});

it.each([
  { fixture: business, category: "企業オーナー" },
  { fixture: admin, category: "運営管理者" },
])(
  "ロール編集・委譲・招待でのプラン上限 / $category でも所有企業プランを超えるロール作成と拡張はできない",
  async (props) => {
    await setPlan("business", "demo-store", PLAN.businessManage);
    await expect(
      access.saveRole(props.fixture, {
        scope: "demo-store",
        name: "上限超過",
        permissions: ["product.update"],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      access.saveRole(props.fixture, {
        scope: "demo-store",
        id: "demo-store:staff",
        name: "上限超過",
        permissions: ["order:read", "product.read", "product.update"],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await query.audit("platform")).toEqual([]);
  },
);

it("ロール編集・委譲・招待でのプラン上限 / 企業ロール編集は一般ユーザーの個人プランへ影響せず所有企業プランで判定する", async () => {
  await setPlan("customer", customer.userId, PLAN.customerRead);
  await expect(
    access.saveRole(business, {
      scope: "demo-store",
      id: "demo-store:staff",
      name: "企業共有",
      permissions: ["order:read", "order:update", "product.read"],
    }),
  ).resolves.toHaveProperty("id", "demo-store:staff");
  expect((await query.grant(customer.userId, "demo-store"))?.permissions).not.toContain(
    "order:create",
  );
  await setPlan("business", "demo-store", PLAN.businessManage);
  await access.saveRole(admin, {
    scope: "demo-store",
    id: "demo-store:staff",
    name: "閲覧担当",
    permissions: READ_PERMISSIONS,
  });
  await expect(
    access.saveRole(admin, {
      scope: "demo-store",
      id: "demo-store:staff",
      name: "企業共有",
      permissions: ["order:read", "order:update", "product.read"],
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("ロール編集・委譲・招待でのプラン上限 / 降格前の権限を保持した純粋なロール縮小は引き続き許可する", async () => {
  await defineRole("demo-store:legacy", ["order:read", "product.read", "product.update"]);
  await setPlan("business", "demo-store", PLAN.businessManage);
  await access.saveRole(business, {
    scope: "demo-store",
    id: "demo-store:legacy",
    name: "縮小",
    permissions: ["product.read", "product.update"],
  });
  const state = await repository.load("demo-store");
  expect(
    state.roles.find((role) => role.id === "demo-store:legacy")?.permissions.toSorted(),
  ).toEqual(["product.read", "product.update"]);
  await expect(
    access.saveRole(business, {
      scope: "demo-store",
      id: "demo-store:legacy",
      name: "再拡張",
      permissions: ["order:read", "product.read", "product.update"],
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("ロール編集・委譲・招待でのプラン上限 / プラン変更後も自分のロール権限を超える付与と編集を拒否する", async () => {
  await addRolePermission("demo-store:staff", "role.manage");
  await addRolePermission("demo-store:staff", "member.assign_role");
  await setPlan("business", "demo-store", PLAN.businessManage);
  await defineRole("demo-store:privileged", ["order:read", "member.invite"]);
  await expect(
    access.saveRole(member, {
      scope: "demo-store",
      id: "demo-store:staff",
      name: "自己昇格",
      permissions: [
        "order:read",
        "product.read",
        "role.manage",
        "member.assign_role",
        "member.invite",
      ],
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    access.assignRole(member, {
      scope: "demo-store",
      membershipId: "business:demo-store:demo-member",
      roleId: "demo-store:privileged",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    access.saveRole(member, {
      scope: "demo-store",
      id: "demo-store:privileged",
      name: "他者縮小",
      permissions: ["order:read"],
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("ロール編集・委譲・招待でのプラン上限 / 低いプランでも現在のロール変更権限があればオーナーを引き継げる", async () => {
  await setPlan("business", "demo-store", PLAN.businessManage);
  await access.assignRole(business, {
    scope: "demo-store",
    membershipId: "business:demo-store:demo-member",
    roleId: "demo-store:owner",
  });
  await access.removeMember(business, {
    scope: "demo-store",
    membershipId: "business:demo-store:demo-user",
  });
  expect(await query.grant(business.userId, "demo-store")).toBeNull();
  expect(await query.grant(member.userId, "demo-store")).toMatchObject({
    protectedRole: true,
  });
  expect((await query.grant(member.userId, "demo-store"))?.permissions).not.toContain(
    "product.update",
  );
});

it("ロール編集・委譲・招待でのプラン上限 / 低いプランでも最後のオーナー保護と実操作の権限検査を維持する", async () => {
  await setPlan("business", "demo-store", PLAN.businessManage);
  await expect(
    access.removeMember(business, {
      scope: "demo-store",
      membershipId: "business:demo-store:demo-user",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(
    access.assignRole(business, {
      scope: "demo-store",
      membershipId: "business:demo-store:demo-user",
      roleId: "demo-store:staff",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await setPlan("business", "demo-store", PLAN.businessRead);
  await expect(
    access.assignRole(business, {
      scope: "demo-store",
      membershipId: "business:demo-store:demo-member",
      roleId: "demo-store:owner",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("ロール編集・委譲・招待でのプラン上限 / 招待発行後に発行者のプランから招待権限が消えたら承諾を拒否する", async () => {
  const invitation = await access.invite(business, {
    scope: "demo-store",
    email: "invited@example.com",
    roleId: "demo-store:staff",
    actorKind: "business",
  });
  await access.assignPlan(admin, {
    category: "business",
    id: "demo-store",
    planCode: PLAN.businessNoInvite,
  });
  await expect(
    access.acceptInvitation(
      {
        ...member,
        userId: "",
        subjectId: "invited-user",
        email: "invited@example.com",
        tenantId: "",
      },
      { token: invitation.token, name: "招待先" },
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(await query.resolveAccount("invited-user", "business")).toBeNull();
  expect(await repository.findInvitation(await hashInvitation(invitation.token))).not.toBeNull();
});

it("ロール編集・委譲・招待でのプラン上限 / 招待権限を保った降格では元のロール権限内のオーナー招待を承諾できる", async () => {
  const invitation = await access.invite(business, {
    scope: "demo-store",
    email: "new-owner@example.com",
    roleId: "demo-store:owner",
    actorKind: "business",
  });
  await access.assignPlan(admin, {
    category: "business",
    id: "demo-store",
    planCode: PLAN.businessManage,
  });
  await access.acceptInvitation(
    {
      ...member,
      userId: "",
      subjectId: "new-owner",
      email: "new-owner@example.com",
      tenantId: "",
    },
    { token: invitation.token, name: "次のオーナー" },
  );
  const account = await query.resolveAccount("new-owner", "business");
  expect(account).not.toBeNull();
  if (!account) {
    throw new Error("招待先の企業会員が保存されていません");
  }

  const grant = await query.grant(account.id, "demo-store");
  expect(grant).toMatchObject({ protectedRole: true });
  expect(grant?.permissions).not.toContain("product.update");
  expect(grant?.rolePermissions).toContain("product.update");
  expect(await repository.findInvitation(await hashInvitation(invitation.token))).toBeNull();
});

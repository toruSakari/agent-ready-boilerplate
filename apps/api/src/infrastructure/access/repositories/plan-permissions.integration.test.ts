import { PlanAssignment } from "#api/domain/access/entities/plan-assignment.ts";
import { AccessOrganizationAssignPlanInputDto } from "#api/application/access/dtos/access-organization-assign-plan-input-dto.ts";
// @vitest-environment node
import { D1AccessQuery } from "#api/infrastructure/access/queries/d1-access-query.ts";
import {
  PLAN,
  READ_PERMISSIONS,
  TEST_CATALOG,
  admin,
  business,
  customer,
  member,
  platform,
  repository,
  query,
  rawAccess,
  access,
  authenticate,
  sql,
  setPlan,
  addRolePermission,
  assignmentAudit,
} from "#api/infrastructure/access/repositories/plan-permissions.integration.test-fixture.ts";
import { AccountIdentityProvider } from "#api/application/auth/providers/account-identity-provider.ts";
import { prepareAuthorizedActor } from "#api/application/auth/policies/prepare-authorized-actor.ts";
import {
  CUSTOMER_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { expect, it } from "vite-plus/test";
import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";

it("個人・企業プランの権限上限と独立性 / 所属・企業ロールなしの一般ユーザーでも個人プランごとに権限を制限する", async () => {
  expect((await query.grant("customer:demo-user", "demo-store"))?.permissions).toEqual(
    expect.arrayContaining([...CUSTOMER_PERMISSIONS]),
  );
  const limited = await query.grant("customer:demo-customer", "demo-store");
  expect(limited?.permissions.toSorted()).toEqual(READ_PERMISSIONS.toSorted());
  expect(limited?.rolePermissions).toEqual(expect.arrayContaining([...CUSTOMER_PERMISSIONS]));
});
it("個人・企業プランの権限上限と独立性 / 一般ユーザーの個人プランは販売先企業に依存せず企業プランと混ざらない", async () => {
  expect((await query.grant(customer.userId, "demo-second"))?.permissions).toContain(
    "order:create",
  );
  await setPlan("customer", customer.userId, PLAN.customerRead);
  for (const scope of ["demo-store", "demo-second"]) {
    expect((await query.grant(customer.userId, scope))?.permissions.toSorted()).toEqual(
      READ_PERMISSIONS.toSorted(),
    );
  }
});
it("個人・企業プランの権限上限と独立性 / 同じ企業担当者でも選択企業ごとのプラン上限を使う", async () => {
  expect((await query.grant(business.userId, "demo-store"))?.permissions).toContain(
    "product.update",
  );
  expect((await query.grant(business.userId, "demo-second"))?.permissions.toSorted()).toEqual(
    READ_PERMISSIONS.toSorted(),
  );
});
it("個人・企業プランの権限上限と独立性 / 同じ本人の顧客・企業・運営サービスは独立している", async () => {
  await setPlan("customer", customer.userId, null);
  expect((await query.grant(customer.userId, "demo-store"))?.permissions).toEqual([]);
  expect((await query.grant(business.userId, "demo-store"))?.permissions).toContain(
    "product.update",
  );
  await setPlan("business", "demo-store", null);
  expect((await query.grant(business.userId, "demo-store"))?.permissions).toEqual([]);
  expect((await query.grant(admin.userId, "platform"))?.permissions).toEqual(
    expect.arrayContaining([...PLATFORM_PERMISSIONS]),
  );
});
it("個人・企業プランの権限上限と独立性 / プランに含まれていてもロールにない権限は付与しない", async () => {
  expect((await query.grant(member.userId, "demo-store"))?.permissions.toSorted()).toEqual(
    READ_PERMISSIONS.toSorted(),
  );
  await expect(
    access.saveRole(member, { scope: "demo-store", name: "昇格", permissions: ["order:read"] }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("個人・企業プランの権限上限と独立性 / 上限適用前のロール権限も対象サービス外の権限を含まない", async () => {
  await sql(
    "INSERT INTO customer_memberships (id,organizations_id,customer_accounts_id,access_roles_id) VALUES ('customer:legacy-owner','demo-store','customer:demo-user','demo-store:owner')",
  );
  await addRolePermission("demo-store:owner", "plan.manage");
  await addRolePermission("platform:admin", "product.update");
  for (const [id, scope, forbidden] of [
    [customer.userId, "demo-store", "member.invite"],
    [business.userId, "demo-store", "plan.manage"],
    [admin.userId, "platform", "product.update"],
  ] as const) {
    const facts = await new D1AccessQuery(platform.env.DB).grantFacts(id, scope);
    if (id === customer.userId) {
      expect(facts?.rolePermissions).not.toContain(forbidden);
    } else {
      expect(facts?.rolePermissions).toContain(forbidden);
    }

    expect(facts).not.toHaveProperty("permissions");
    const grant = await query.grant(id, scope);
    expect(grant?.permissions).not.toContain(forbidden);
    expect(grant?.rolePermissions).not.toContain(forbidden);
  }
});
it("個人・企業プランの権限上限と独立性 / 運営の操作もロール権限が必要で企業プランから補えない", async () => {
  await sql(
    "UPDATE operator_memberships SET access_roles_id='platform:assistant' WHERE operator_accounts_id='operator:demo-user'",
  );
  expect((await access.session(admin)).platformPermissions).not.toContain("plan.manage");
  await expect(
    access.assignPlan(admin, {
      category: "business",
      id: "demo-store",
      planCode: PLAN.businessRead,
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it.each([
  { category: "customer", id: "customer:demo-user", planCode: null, reason: "未割当" },
  { category: "customer", id: "customer:demo-user", planCode: "test:unknown", reason: "未知" },
  {
    category: "customer",
    id: "customer:demo-user",
    planCode: PLAN.businessFull,
    reason: "別サービス",
  },
  { category: "business", id: "demo-store", planCode: null, reason: "未割当" },
  { category: "business", id: "demo-store", planCode: "test:unknown", reason: "未知" },
  { category: "business", id: "demo-store", planCode: PLAN.customerFull, reason: "別サービス" },
] as const)(
  "個人・企業プランの権限上限と独立性 / $category の $reason プランはfail closedでロールを保持する",
  async (props) => {
    await setPlan(props.category, props.id, props.planCode);
    expect((await query.plan({ category: props.category, id: props.id })).permissions).toEqual([]);
    const grant = await query.grant(
      props.category === "business" ? business.userId : customer.userId,
      "demo-store",
    );
    expect(grant).toMatchObject({ active: true, permissions: [] });
    expect(grant?.rolePermissions).toContain("order:read");
    expect(grant?.rolePermissions.includes("order:create")).toBe(props.category === "customer");
  },
);
it("個人・企業プランの権限上限と独立性 / プランだけでは企業所属を作らない", async () => {
  expect(await query.grant(member.userId, "demo-second")).toBeNull();
  await expect(access.session({ ...member, tenantId: "demo-second" })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
it.each([
  {
    fixture: business,
    category: "business",
    id: "demo-store",
    code: PLAN.businessRead,
    permission: "product.update",
  },
  {
    fixture: customer,
    category: "customer",
    id: "customer:demo-user",
    code: PLAN.customerRead,
    permission: "order:create",
  },
] as const)(
  "現在のプランと新規登録 / $category の認証済みIdentityも降格後の権限を使えない",
  async (props) => {
    const { provider, identity } = await authenticate(props.fixture);
    expect(identity.permissions).toContain(props.permission);
    if (props.category === "customer") {
      await access.changeCustomerPlan(customer, { planCode: props.code });
    } else {
      await access.assignPlan(admin, {
        category: props.category,
        id: props.id,
        planCode: props.code,
      });
    }

    await expect(
      prepareAuthorizedActor(provider, identity, [props.permission]),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect((await access.session(props.fixture)).permissions).not.toContain(props.permission);
  },
);
it("現在のプランと新規登録 / 新しい企業のプランは明示割当までNULLである", async () => {
  const created = await access.createOrganization(admin, { name: "新しい企業" });
  expect(await query.plan({ category: "business", id: created.id })).toEqual({
    code: null,
    permissions: [],
  });
  expect(
    await platform.env.DB.prepare("SELECT plan_code FROM organizations WHERE id=?")
      .bind(created.id)
      .first(),
  ).toEqual({ plan_code: null });
});
it("現在のプランと新規登録 / 新しい顧客登録ではデモプランを暗黙に付与しない", async () => {
  const created = await access.registerCustomer(
    {
      ...customer,
      userId: "",
      subjectId: "new-customer",
      email: "new-customer@example.com",
      tenantId: "",
    },
    { name: "新しい顧客" },
  );
  expect(await query.plan({ category: "customer", id: created.accountId })).toEqual({
    code: null,
    permissions: [],
  });
  expect(
    await platform.env.DB.prepare("SELECT plan_code FROM customer_accounts WHERE id=?")
      .bind(created.accountId)
      .first(),
  ).toEqual({ plan_code: null });
});
it("プラン割当の認可と原子性 / プラン一覧は指定サービスの定義だけを返す", async () => {
  for (const category of ["business", "customer"] as const) {
    const plans =
      category === "customer"
        ? (await access.customerPlans(customer)).plans
        : await access.listPlans(admin, category);
    expect(plans.map((plan) => plan.code).toSorted()).toEqual(
      TEST_CATALOG.filter((plan) => plan.category === category)
        .map((plan) => plan.code)
        .toSorted(),
    );
    expect(query.plans(category).every((plan) => plan.category === category)).toBe(true);
  }
});
it("プラン割当の認可と原子性 / 企業オーナーは運営のプラン一覧も割当も操作できない", async () => {
  await expect(access.listPlans(business, "business")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(
    access.assignPlan(business, {
      category: "business",
      id: "demo-store",
      planCode: PLAN.businessRead,
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect((await repository.load("platform")).version).toBe(0);
  expect(await query.audit("platform")).toEqual([]);
});
it.each<PermissionCode>(["plan.manage", "role.manage"])(
  "プラン割当の認可と原子性 / Identityの自己申告では%sの認可境界を通過できない",
  async (permission) => {
    const provider = new AccountIdentityProvider({ authenticate: async () => admin }, query);
    const forged: Identity = { ...admin, permissions: PLATFORM_PERMISSIONS, role: "admin" };
    await expect(prepareAuthorizedActor(provider, forged, [permission])).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect((await repository.load("platform")).version).toBe(0);
    expect(await query.audit("platform")).toEqual([]);
  },
);
it("プラン割当の認可と原子性 / 企業プラン割当は版更新と所有者を対象とした監査を同時に保存する", async () => {
  await access.assignPlan(admin, {
    category: "business",
    id: "demo-store",
    planCode: PLAN.businessRead,
  });
  expect(await query.plan({ category: "business", id: "demo-store" })).toEqual({
    code: PLAN.businessRead,
    permissions: READ_PERMISSIONS,
  });
  expect((await repository.load("platform")).version).toBe(1);
  expect(await query.audit("platform")).toEqual([
    expect.objectContaining({
      actorId: admin.userId,
      scope: "platform",
      action: "plan.assign",
      targetId: "demo-store",
    }),
  ]);
  expect((await query.grant(business.userId, "demo-store"))?.rolePermissions).toContain(
    "product.update",
  );
});
it("プラン割当の認可と原子性 / 一般ユーザーのプラン割当は個人だけを更新し全販売先に反映する", async () => {
  await access.changeCustomerPlan(customer, { planCode: PLAN.customerRead });
  for (const scope of ["demo-store", "demo-second"]) {
    expect((await query.grant(customer.userId, scope))?.permissions).not.toContain("order:create");
  }

  expect((await query.plan({ category: "business", id: "demo-store" })).code).toBe(
    PLAN.businessFull,
  );
  expect(await query.audit("customer")).toEqual([
    expect.objectContaining({
      action: "plan.change",
      actorId: customer.userId,
      targetId: customer.userId,
    }),
  ]);
});
it("プラン割当の認可と原子性 / NULLへの明示変更でプラン権限をすべて失効する", async () => {
  await access.changeCustomerPlan(customer, { planCode: null });
  expect(await query.plan({ category: "customer", id: customer.userId })).toEqual({
    code: null,
    permissions: [],
  });
  expect((await query.grant(customer.userId, "demo-store"))?.permissions).toEqual([]);
  expect((await repository.load("platform")).version).toBe(1);
});
it.each([
  { planCode: "test:unknown", reason: "未知" },
  { planCode: PLAN.customerFull, reason: "別サービス" },
])("プラン割当の認可と原子性 / $reason のプラン割当は変更も監査も保存しない", async (props) => {
  await expect(
    access.assignPlan(admin, { category: "business", id: "demo-store", planCode: props.planCode }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect((await query.plan({ category: "business", id: "demo-store" })).code).toBe(
    PLAN.businessFull,
  );
  expect((await repository.load("platform")).version).toBe(0);
  expect(await query.audit("platform")).toEqual([]);
});
it("個人プラン / 退会した一般ユーザーの変更を拒否する", async () => {
  await access.withdraw(customer);
  await expect(
    access.changeCustomerPlan(customer, { planCode: PLAN.customerFull }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect((await query.audit("customer")).some((entry) => entry.action === "plan.change")).toBe(
    false,
  );
});
it("プラン割当の認可と原子性 / 存在しない所有者へのプラン割当を拒否する", async () => {
  for (const category of ["customer", "business"] as const) {
    await expect(
      access.assignPlan(admin, {
        category,
        id: "missing-owner",
        planCode: category === "customer" ? PLAN.customerFull : PLAN.businessFull,
      }),
    ).rejects.toMatchObject({ code: category === "customer" ? "FORBIDDEN" : "NOT_FOUND" });
  }

  expect((await repository.load("platform")).version).toBe(0);
  expect(await query.audit("platform")).toEqual([]);
});
it("プラン割当の認可と原子性 / 認可後に版が変わったプラン割当は古いスナップショットで競合する", async () => {
  const { provider, identity } = await authenticate(admin);
  const state = await repository.load("platform");
  const actor = await prepareAuthorizedActor(provider, identity, ["plan.manage"], {
    scope: "platform",
    state,
  });
  await access.assignPlan(admin, {
    category: "business",
    id: "demo-store",
    planCode: PLAN.businessManage,
  });
  await expect(
    rawAccess.assignPlan(
      AccessOrganizationAssignPlanInputDto.parse({
        identity: actor,
        input: {
          category: "business",
          id: "demo-store",
          planCode: PLAN.businessRead,
        },
      }),
    ),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect((await query.plan({ category: "business", id: "demo-store" })).code).toBe(
    PLAN.businessManage,
  );
  expect((await repository.load("platform")).version).toBe(1);
  expect(await query.audit("platform")).toHaveLength(1);
});
it("プラン割当の認可と原子性 / D1の古い版によるplanAssignmentsは更新も監査も追加しない", async () => {
  const state = await repository.load("platform");
  const assignment = new PlanAssignment(
    "business",
    AccessId.create("demo-store"),
    AccessId.create(PLAN.businessRead),
  );
  const planAssignments = [assignment];
  expect(
    await repository.commit(state.version, { planAssignments }, assignmentAudit("plan-first")),
  ).toBe(true);
  expect(
    await repository.commit(
      state.version,
      { planAssignments: [new PlanAssignment(assignment.category, assignment.id, null)] },
      assignmentAudit("plan-stale"),
    ),
  ).toBe(false);
  expect((await query.plan({ category: "business", id: "demo-store" })).code).toBe(
    PLAN.businessRead,
  );
  expect((await query.audit("platform")).map((entry) => entry.id)).toEqual(["plan-first"]);
  expect((await repository.load("platform")).version).toBe(1);
});

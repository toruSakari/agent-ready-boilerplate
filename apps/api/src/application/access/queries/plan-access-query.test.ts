import type { AccessQuerySource } from "#api/application/access/queries/access-query.ts";
import { PlanAccessQuery } from "#api/application/access/queries/plan-access-query.ts";
import type { PlanOwner } from "#api/domain/access/entities/plan-assignment.ts";
import { PlanDefinition } from "#api/domain/access/entities/plan-definition.ts";
import type { AccountCategoryCode } from "#api/domain/access/policies/account-categories.ts";
import { CUSTOMER_PERMISSIONS } from "#api/domain/access/policies/permission-catalog.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import { PermissionValue } from "#api/domain/access/value-objects/permission.ts";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";
import { expect, it, vi } from "vite-plus/test";

type GrantFacts = NonNullable<Awaited<ReturnType<AccessQuerySource["grantFacts"]>>>;

const customerPlan = PlanDefinition.create({
  code: "customer:limited",
  name: "通常会員限定プラン",
  category: "customer",
  permissions: ["order:read", "product.read"],
});
const customerExpandedPlan = PlanDefinition.create({
  code: "customer:expanded",
  name: "通常会員拡張プラン",
  category: "customer",
  permissions: ["order:read", "order:create", "product.read"],
});
const businessPlan = PlanDefinition.create({
  code: "business:limited",
  name: "企業限定プラン",
  category: "business",
  permissions: ["member.read", "member.invite", "order:read"],
});
const businessExpandedPlan = PlanDefinition.create({
  code: "business:expanded",
  name: "企業拡張プラン",
  category: "business",
  permissions: ["member.read", "member.invite", "order:read", "product.update"],
});
const catalog = Object.freeze([
  customerPlan,
  businessPlan,
  customerExpandedPlan,
  businessExpandedPlan,
]);

function grantFacts(overrides: Partial<GrantFacts> = {}): GrantFacts {
  return {
    active: true,
    protectedRole: false,
    category: "business",
    planCode: businessPlan.code,
    rolePermissions: ["member.read", "member.invite", "product.update"],
    ...overrides,
  };
}

// データソースの既定値は未登録・権限なし。各ケースで必要な保存事実だけを明示する。
function accessSource() {
  return {
    planCode: vi.fn<AccessQuerySource["planCode"]>().mockResolvedValue(null),
    grantFacts: vi.fn<AccessQuerySource["grantFacts"]>().mockResolvedValue(null),
    resolveAccount: vi.fn<AccessQuerySource["resolveAccount"]>().mockResolvedValue(null),
    isRegistered: vi.fn<AccessQuerySource["isRegistered"]>().mockResolvedValue(false),
    invitationIsCurrent: vi.fn<AccessQuerySource["invitationIsCurrent"]>().mockResolvedValue(false),
    hasQualifiedOwner: vi.fn<AccessQuerySource["hasQualifiedOwner"]>().mockResolvedValue(false),
    qualified: vi.fn<AccessQuerySource["qualified"]>().mockResolvedValue(false),
    organizations: vi.fn<AccessQuerySource["organizations"]>().mockResolvedValue([]),
    audit: vi.fn<AccessQuerySource["audit"]>().mockResolvedValue([]),
  } satisfies AccessQuerySource;
}

it("プランを考慮したアクセス照会（PlanAccessQuery） / 注入したカタログを対象サービスで絞り、データソースを読まない", () => {
  const source = accessSource();
  const query = new PlanAccessQuery(source, catalog);

  expect(query.plans("customer")).toEqual([customerPlan, customerExpandedPlan]);
  expect(query.plans("business")).toEqual([businessPlan, businessExpandedPlan]);
  expect(source.planCode).not.toHaveBeenCalled();
  expect(source.grantFacts).not.toHaveBeenCalled();
});

it("プランを考慮したアクセス照会（PlanAccessQuery） / カタログ未指定時は開発用プランを使う", async () => {
  const source = accessSource();
  source.planCode.mockResolvedValue("customer:demo");
  const query = new PlanAccessQuery(source);

  expect(query.plans("customer").map((plan) => plan.code)).toEqual(["customer:demo"]);
  expect(query.plans("business").map((plan) => plan.code)).toEqual(["business:demo"]);
  expect(await query.plan({ category: "customer", id: "customer-a" })).toEqual({
    code: "customer:demo",
    permissions: ["order:read", "order:create", "order:update", "product.read"],
  });
});

it("プランを考慮したアクセス照会（PlanAccessQuery） / 空の注入カタログを既定プランで補わない", async () => {
  const source = accessSource();
  source.planCode.mockResolvedValue("customer:demo");
  source.grantFacts.mockResolvedValue(
    grantFacts({
      category: "customer",
      planCode: "customer:demo",
      rolePermissions: ["order:read"],
    }),
  );
  const query = new PlanAccessQuery(source, []);

  expect(query.plans("customer")).toEqual([]);
  expect(await query.plan({ category: "customer", id: "customer-a" })).toEqual({
    code: "customer:demo",
    permissions: [],
  });
  expect(await query.grant("customer-a", "organization-a")).toMatchObject({ permissions: [] });
});

it("プランを考慮したアクセス照会（PlanAccessQuery） / 構築時に同一サービス内で同じコードの重複を拒否する", () => {
  for (const duplicate of [
    customerPlan,
    PlanDefinition.create({ ...customerExpandedPlan.toSnapshot(), code: customerPlan.code }),
  ]) {
    expect(() => new PlanAccessQuery(accessSource(), [customerPlan, duplicate])).toThrow();
  }
});

it("プランを考慮したアクセス照会（PlanAccessQuery） / 同じコードでも対象サービスのプランだけを解決する", async () => {
  const source = accessSource();
  source.planCode.mockResolvedValue(customerPlan.code);
  const rolePermissions: PermissionCode[] = ["order:read", "product.read", "member.read"];
  source.grantFacts
    .mockResolvedValueOnce(
      grantFacts({ category: "customer", planCode: customerPlan.code, rolePermissions }),
    )
    .mockResolvedValueOnce(grantFacts({ planCode: customerPlan.code, rolePermissions }));
  const business = PlanDefinition.create({ ...businessPlan.toSnapshot(), code: customerPlan.code });
  const query = new PlanAccessQuery(source, [customerPlan, business]);

  expect((await query.plan({ category: "customer", id: "owner-a" })).permissions).toEqual([
    "order:read",
    "product.read",
  ]);
  expect((await query.plan({ category: "business", id: "owner-a" })).permissions).toEqual([
    "member.read",
    "member.invite",
    "order:read",
  ]);
  expect((await query.grant("customer-a", "organization-a"))?.permissions).toEqual([
    "order:read",
    "product.read",
  ]);
  expect((await query.grant("business-a", "organization-a"))?.permissions).toEqual([
    "order:read",
    "member.read",
  ]);
});

it("プランを考慮したアクセス照会（PlanAccessQuery） / 構築時にカタログ全体のサービス上限を検証する", () => {
  const invalidPlan = {
    ...customerPlan.toSnapshot(),
    permissions: [PermissionValue.create("organization.manage")],
  };

  expect(() => new PlanAccessQuery(accessSource(), [businessPlan, invalidPlan])).toThrow(
    InvalidValueObjectError,
  );
});

it("プランを考慮したアクセス照会（PlanAccessQuery） / プラン照会のたびに現在のコードを読み、格上げ・格下げ・解除を反映する", async () => {
  const source = accessSource();
  const owner: PlanOwner = { category: "customer", id: "customer-a" };
  source.planCode
    .mockResolvedValueOnce(customerPlan.code)
    .mockResolvedValueOnce(customerExpandedPlan.code)
    .mockResolvedValueOnce(customerPlan.code)
    .mockResolvedValueOnce(null);
  const query = new PlanAccessQuery(source, catalog);

  expect(await query.plan(owner)).toEqual({
    code: customerPlan.code,
    permissions: ["order:read", "product.read"],
  });
  expect(await query.plan(owner)).toEqual({
    code: customerExpandedPlan.code,
    permissions: ["order:read", "order:create", "product.read"],
  });
  expect(await query.plan(owner)).toEqual({
    code: customerPlan.code,
    permissions: ["order:read", "product.read"],
  });
  expect(await query.plan(owner)).toEqual({ code: null, permissions: [] });
  expect(source.planCode).toHaveBeenCalledTimes(4);
  for (const [actualOwner] of source.planCode.mock.calls) {
    expect(actualOwner).toEqual(owner);
  }
});

it("プランを考慮したアクセス照会（PlanAccessQuery） / 同じIDでも個人と企業のプラン所有を混ぜず、他企業の変更も独立させる", async () => {
  const source = accessSource();
  const assignments = new Map([
    ["customer:shared-id", customerPlan.code],
    ["business:shared-id", businessPlan.code],
    ["business:organization-b", businessExpandedPlan.code],
  ]);
  source.planCode.mockImplementation(async (owner) => {
    return assignments.get(`${owner.category}:${owner.id}`) ?? null;
  });
  const query = new PlanAccessQuery(source, catalog);
  const customer: PlanOwner = { category: "customer", id: "shared-id" };
  const business: PlanOwner = { category: "business", id: "shared-id" };
  const anotherBusiness: PlanOwner = { category: "business", id: "organization-b" };

  expect((await query.plan(customer)).permissions).toEqual(["order:read", "product.read"]);
  expect((await query.plan(business)).permissions).toEqual([
    "member.read",
    "member.invite",
    "order:read",
  ]);
  assignments.delete("business:shared-id");
  expect(await query.plan(business)).toEqual({ code: null, permissions: [] });
  expect((await query.plan(customer)).code).toBe(customerPlan.code);
  expect((await query.plan(anotherBusiness)).code).toBe(businessExpandedPlan.code);
  expect(source.planCode.mock.calls.map((props) => props[0])).toEqual([
    customer,
    business,
    business,
    customer,
    anotherBusiness,
  ]);
});

it.each([
  { category: "customer", code: null },
  { category: "customer", code: "unknown" },
  { category: "customer", code: businessPlan.code },
  { category: "business", code: null },
  { category: "business", code: "unknown" },
  { category: "business", code: customerPlan.code },
] as const)(
  "プランを考慮したアクセス照会（PlanAccessQuery） / $categoryの未設定・未知・別サービスのコード$codeは権限なし",
  async (props) => {
    const source = accessSource();
    source.planCode.mockResolvedValue(props.code);
    source.grantFacts.mockResolvedValue(
      grantFacts({
        category: props.category,
        planCode: props.code,
        rolePermissions: ["order:read"],
      }),
    );
    const query = new PlanAccessQuery(source, catalog);

    expect(await query.plan({ category: props.category, id: "owner-a" })).toEqual({
      code: props.code,
      permissions: [],
    });
    expect(await query.grant("account-a", "organization-a")).toEqual({
      active: true,
      protectedRole: false,
      permissions: [],
      rolePermissions: props.category === "customer" ? CUSTOMER_PERMISSIONS : ["order:read"],
    });
  },
);

it("プランを考慮したアクセス照会（PlanAccessQuery） / 権限照会のたびに現在のプラン・ロールを読み、前回の結果を再利用しない", async () => {
  const source = accessSource();
  source.grantFacts
    .mockResolvedValueOnce(grantFacts({ planCode: businessExpandedPlan.code }))
    .mockResolvedValueOnce(grantFacts())
    .mockResolvedValueOnce(grantFacts({ rolePermissions: ["member.read"] }))
    .mockResolvedValueOnce(grantFacts({ active: false, planCode: businessExpandedPlan.code }))
    .mockResolvedValueOnce(grantFacts({ planCode: businessExpandedPlan.code }))
    .mockResolvedValueOnce(null);
  const query = new PlanAccessQuery(source, catalog);

  const first = await query.grant("business-a", "organization-a");
  expect(first?.permissions).toEqual(["member.read", "member.invite", "product.update"]);
  expect((await query.grant("business-a", "organization-a"))?.permissions).toEqual([
    "member.read",
    "member.invite",
  ]);
  expect((await query.grant("business-a", "organization-a"))?.permissions).toEqual(["member.read"]);
  expect(await query.grant("business-a", "organization-a")).toMatchObject({
    active: false,
    permissions: [],
  });
  expect((await query.grant("business-a", "organization-a"))?.permissions).toEqual([
    "member.read",
    "member.invite",
    "product.update",
  ]);
  expect(await query.grant("business-a", "organization-a")).toBeNull();
  expect(first?.permissions).toEqual(["member.read", "member.invite", "product.update"]);
  expect(source.grantFacts.mock.calls).toEqual(
    Array.from({ length: 6 }, () => ["business-a", "organization-a"]),
  );
  expect(source.planCode).not.toHaveBeenCalled();
});

it("プランを考慮したアクセス照会（PlanAccessQuery） / 企業の委任権限はサービス上限で絞り、プラン上限では削らない", async () => {
  const source = accessSource();
  source.grantFacts.mockResolvedValue(
    grantFacts({
      protectedRole: true,
      rolePermissions: ["product.update", "member.invite", "organization.manage", "member.invite"],
    }),
  );
  const query = new PlanAccessQuery(source, catalog);

  expect(await query.grant("business-a", "organization-a")).toEqual({
    active: true,
    protectedRole: true,
    permissions: ["member.invite"],
    rolePermissions: ["product.update", "member.invite", "member.invite"],
  });
});

it("プランを考慮したアクセス照会（PlanAccessQuery） / 一般ユーザーは企業ロールを使わずサービス上限と個人プランだけを適用する", async () => {
  const source = accessSource();
  source.grantFacts.mockResolvedValue(
    grantFacts({
      category: "customer",
      planCode: customerPlan.code,
      rolePermissions: ["order:create", "order:read", "member.invite", "product.update"],
    }),
  );
  const query = new PlanAccessQuery(source, catalog);

  expect(await query.grant("customer-a", "organization-a")).toEqual({
    active: true,
    protectedRole: false,
    permissions: ["order:read", "product.read"],
    rolePermissions: CUSTOMER_PERMISSIONS,
  });
});

it.each([null, "unknown", customerPlan.code, businessPlan.code])(
  "プランを考慮したアクセス照会（PlanAccessQuery） / 運営は商用コード%sで制限せず、運営サービスの権限だけを使う",
  async (planCode) => {
    const source = accessSource();
    source.grantFacts.mockResolvedValue(
      grantFacts({
        category: "operator",
        planCode,
        protectedRole: true,
        rolePermissions: ["plan.manage", "audit.read", "product.update", "order:read"],
      }),
    );
    const query = new PlanAccessQuery(source, catalog);

    expect(await query.grant("operator-a", "platform")).toEqual({
      active: true,
      protectedRole: true,
      permissions: ["plan.manage", "audit.read"],
      rolePermissions: ["plan.manage", "audit.read"],
    });
    expect(source.planCode).not.toHaveBeenCalled();
  },
);

it("プランを考慮したアクセス照会（PlanAccessQuery） / プランや保護ロールだけではロールにない権限を付与しない", async () => {
  const source = accessSource();
  source.grantFacts.mockResolvedValue(grantFacts({ protectedRole: true, rolePermissions: [] }));
  const query = new PlanAccessQuery(source, catalog);

  expect(await query.grant("business-a", "organization-a")).toEqual({
    active: true,
    protectedRole: true,
    permissions: [],
    rolePermissions: [],
  });
});

it("プランを考慮したアクセス照会（PlanAccessQuery） / 所属の事実がなければ権限を生成しない", async () => {
  const source = accessSource();
  const query = new PlanAccessQuery(source, catalog);

  expect(await query.grant("missing", "organization-a")).toBeNull();
  expect(source.grantFacts).toHaveBeenCalledExactlyOnceWith("missing", "organization-a");
  expect(source.planCode).not.toHaveBeenCalled();
});

it.each([
  { category: "customer", planCode: customerPlan.code, scope: "organization-a" },
  { category: "business", planCode: businessExpandedPlan.code, scope: "organization-a" },
  { category: "operator", planCode: null, scope: "platform" },
] satisfies { category: AccountCategoryCode; planCode: string | null; scope: string }[])(
  "プランを考慮したアクセス照会（PlanAccessQuery） / 無効な$categoryの所属には利用可能な権限を残さない",
  async (props) => {
    const source = accessSource();
    source.grantFacts.mockResolvedValue(
      grantFacts({
        active: false,
        protectedRole: true,
        category: props.category,
        planCode: props.planCode,
        rolePermissions: ["order:read", "member.read", "plan.manage"],
      }),
    );
    const query = new PlanAccessQuery(source, catalog);

    expect(await query.grant("inactive-a", props.scope)).toMatchObject({
      active: false,
      protectedRole: true,
      permissions: [],
    });
  },
);

it("プランを考慮したアクセス照会（PlanAccessQuery） / データソースの事実・ロールと注入カタログを書き換えない", async () => {
  const source = accessSource();
  const rolePermissions: readonly PermissionCode[] = Object.freeze([
    "product.update",
    "member.read",
    "member.read",
    "organization.manage",
  ]);
  const facts = Object.freeze(grantFacts({ rolePermissions }));
  source.grantFacts.mockResolvedValue(facts);
  source.planCode.mockResolvedValue(businessPlan.code);
  const query = new PlanAccessQuery(source, catalog);

  expect((await query.grant("business-a", "organization-a"))?.permissions).toEqual(["member.read"]);
  expect((await query.plan({ category: "business", id: "organization-a" })).permissions).toEqual([
    "member.read",
    "member.invite",
    "order:read",
  ]);
  expect(query.plans("business")).toEqual([businessPlan, businessExpandedPlan]);
  expect(facts).toEqual(grantFacts({ rolePermissions }));
  expect(rolePermissions).toEqual([
    "product.update",
    "member.read",
    "member.read",
    "organization.manage",
  ]);
  expect(catalog).toEqual([customerPlan, businessPlan, customerExpandedPlan, businessExpandedPlan]);
});

it("プランを考慮したアクセス照会（PlanAccessQuery） / 所有者のコード読み取りに失敗したら未知プラン扱いにせず障害を伝える", async () => {
  const source = accessSource();
  const failure = new Error("plan source unavailable");
  source.planCode.mockRejectedValue(failure);
  const query = new PlanAccessQuery(source, catalog);

  await expect(query.plan({ category: "customer", id: "customer-a" })).rejects.toBe(failure);
});

it("プランを考慮したアクセス照会（PlanAccessQuery） / 構築後に呼び出し元のカタログを書き換えても検証済みの定義を維持する", async () => {
  const source = accessSource();
  const permissions = [PermissionValue.create("order:read")];
  const inputPlan = { ...customerPlan.toSnapshot(), permissions };
  const inputCatalog = [inputPlan];
  const query = new PlanAccessQuery(source, inputCatalog);
  source.planCode.mockResolvedValue(customerPlan.code);
  source.grantFacts.mockResolvedValue(
    grantFacts({
      category: "customer",
      planCode: customerPlan.code,
      rolePermissions: ["order:read", "order:create"],
    }),
  );

  permissions.push(PermissionValue.create("order:create"));
  inputPlan.code = customerExpandedPlan.code;
  inputCatalog.length = 0;

  expect(query.plans("customer")).toEqual([
    { ...customerPlan.toSnapshot(), permissions: ["order:read"] },
  ]);
  expect(await query.plan({ category: "customer", id: "customer-a" })).toEqual({
    code: customerPlan.code,
    permissions: ["order:read"],
  });
  expect((await query.grant("customer-a", "organization-a"))?.permissions).toEqual(["order:read"]);
});

it("プランを考慮したアクセス照会（PlanAccessQuery） / 現在の所属・ロール読み取りに失敗したら権限なしで隠さず障害を伝える", async () => {
  const source = accessSource();
  const failure = new Error("grant source unavailable");
  source.grantFacts.mockRejectedValue(failure);
  const query = new PlanAccessQuery(source, catalog);

  await expect(query.grant("business-a", "organization-a")).rejects.toBe(failure);
});

it("プランを考慮したアクセス照会（PlanAccessQuery） / プラン以外の照会は引数と結果を変更せずデータソースへ委譲する", async () => {
  const source = accessSource();
  const account = { id: "business-a", deleted: false };
  const organizations = [{ id: "organization-a", name: "企業A", roleName: "担当者" }];
  const audit = [
    {
      id: "audit-a",
      actorId: "operator-a",
      scope: "platform",
      action: "assign_plan",
      targetId: "organization-a",
      occurredAt: "2026-10-01T00:00:00.000Z",
    },
  ];
  source.resolveAccount.mockResolvedValue(account);
  source.isRegistered.mockResolvedValue(true);
  source.invitationIsCurrent.mockResolvedValue(true);
  source.hasQualifiedOwner.mockResolvedValue(true);
  source.qualified.mockResolvedValue(true);
  source.organizations.mockResolvedValue(organizations);
  source.audit.mockResolvedValue(audit);
  const query = new PlanAccessQuery(source, catalog);

  expect(await query.resolveAccount("subject-a", "business")).toBe(account);
  expect(await query.isRegistered("business-a", "business")).toBe(true);
  expect(await query.invitationIsCurrent("invitation-a", "subject-a", "organization-a")).toBe(true);
  expect(await query.hasQualifiedOwner("organization-a", "membership-a")).toBe(true);
  expect(await query.qualified("customer-a", "organization-a", "customer")).toBe(true);
  expect(await query.organizations("business-a", "business")).toBe(organizations);
  expect(await query.audit("platform")).toBe(audit);
  assertDelegatedCalls(source);
});

it("プランを考慮したアクセス照会（PlanAccessQuery） / 委譲した照会の拒否・未検出結果も変更しない", async () => {
  const source = accessSource();
  const query = new PlanAccessQuery(source, catalog);

  expect(await query.resolveAccount("subject-a", "customer")).toBeNull();
  expect(await query.isRegistered("customer-a", "customer")).toBe(false);
  expect(await query.invitationIsCurrent("invitation-a", "subject-a", "organization-a")).toBe(
    false,
  );
  expect(await query.hasQualifiedOwner("organization-a", "membership-a")).toBe(false);
  expect(await query.qualified("customer-a", "organization-a", "customer")).toBe(false);
  expect(await query.organizations("customer-a", "customer")).toEqual([]);
  expect(await query.audit("organization-a")).toEqual([]);
});

it("プランを考慮したアクセス照会（PlanAccessQuery） / 委譲した照会の障害もそのまま伝える", async () => {
  const source = accessSource();
  const failure = new Error("source unavailable");
  source.resolveAccount.mockRejectedValue(failure);
  source.isRegistered.mockRejectedValue(failure);
  source.invitationIsCurrent.mockRejectedValue(failure);
  source.hasQualifiedOwner.mockRejectedValue(failure);
  source.qualified.mockRejectedValue(failure);
  source.organizations.mockRejectedValue(failure);
  source.audit.mockRejectedValue(failure);
  const query = new PlanAccessQuery(source, catalog);

  await expect(query.resolveAccount("subject-a", "customer")).rejects.toBe(failure);
  await expect(query.isRegistered("customer-a", "customer")).rejects.toBe(failure);
  await expect(
    query.invitationIsCurrent("invitation-a", "subject-a", "organization-a"),
  ).rejects.toBe(failure);
  await expect(query.hasQualifiedOwner("organization-a", "membership-a")).rejects.toBe(failure);
  await expect(query.qualified("customer-a", "organization-a", "customer")).rejects.toBe(failure);
  await expect(query.organizations("customer-a", "customer")).rejects.toBe(failure);
  await expect(query.audit("organization-a")).rejects.toBe(failure);
});

function assertDelegatedCalls(source: ReturnType<typeof accessSource>) {
  expect(source.resolveAccount).toHaveBeenCalledExactlyOnceWith("subject-a", "business");
  expect(source.isRegistered).toHaveBeenCalledExactlyOnceWith("business-a", "business");
  expect(source.invitationIsCurrent).toHaveBeenCalledExactlyOnceWith(
    "invitation-a",
    "subject-a",
    "organization-a",
  );
  expect(source.hasQualifiedOwner).toHaveBeenCalledExactlyOnceWith(
    "organization-a",
    "membership-a",
  );
  expect(source.qualified).toHaveBeenCalledExactlyOnceWith(
    "customer-a",
    "organization-a",
    "customer",
  );
  expect(source.organizations).toHaveBeenCalledExactlyOnceWith("business-a", "business");
  expect(source.audit).toHaveBeenCalledExactlyOnceWith("platform");
  expect(source.planCode).not.toHaveBeenCalled();
  expect(source.grantFacts).not.toHaveBeenCalled();
}

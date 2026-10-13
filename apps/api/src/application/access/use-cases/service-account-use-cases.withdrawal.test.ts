import { accessReaderFixture } from "#api/test/access-reader-fixture.ts";
import {
  BusinessAccountUseCases,
  CustomerAccountUseCases,
  OperatorAccountUseCases,
  MembershipEntity,
  RoleEntity,
  PLATFORM_PERMISSIONS,
  AccessId,
  AccessName,
  PLATFORM_SCOPE,
  AccountCategoryValue,
  PermissionValue,
  invokeRuntime,
  expect,
  it,
  ORGANIZATION,
  PLATFORM,
  customer,
  business,
  operator,
  operatorIdentity,
  identity,
  setup,
  protectedMemberships,
} from "#api/application/access/use-cases/service-account-use-cases.test-fixture.ts";
import type { AuthorizedActor } from "#api/application/access/use-cases/service-account-use-cases.test-fixture.ts";

it.each(["customer", "business", "operator"] as const)(
  "運営による会員削除 / %s会員の削除で状態スナップショットのない実行者を拒否する",
  async (category) => {
    const fixture = setup();
    const cases = {
      customer: new CustomerAccountUseCases(
        fixture.repository,
        accessReaderFixture(fixture.query, fixture.state),
      ),
      business: new BusinessAccountUseCases(
        fixture.repository,
        accessReaderFixture(fixture.query, fixture.state),
      ),
      operator: new OperatorAccountUseCases(
        fixture.repository,
        accessReaderFixture(fixture.query, fixture.state),
      ),
    }[category];
    await expect(
      invokeRuntime(cases, "removeByOperator", [
        { identity: operatorIdentity, accountId: `${category}:shared` },
      ]),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fixture.repository.load).not.toHaveBeenCalled();
    expect(fixture.repository.commit).not.toHaveBeenCalled();
  },
);

it.each(["customer", "business", "operator"] as const)(
  "運営による会員削除 / %s会員の削除で別スコープの状態スナップショットを拒否する",
  async (category) => {
    const fixture = setup();
    const cases =
      fixture.raw[
        ({ customer: "customers", business: "businesses", operator: "operators" } as const)[
          category
        ]
      ];
    const actor: AuthorizedActor = {
      ...operatorIdentity,
      service: "operator",
      platform: true,
      protectedRole: true,
      rolePermissions: PLATFORM_PERMISSIONS,
      accessSnapshot: { scope: ORGANIZATION, state: fixture.state },
    };
    await expect(
      invokeRuntime(cases, "removeByOperator", [
        { identity: actor, accountId: `${category}:shared` },
      ]),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fixture.repository.load).not.toHaveBeenCalled();
    expect(fixture.repository.commit).not.toHaveBeenCalled();
  },
);

it.each(["customer", "business", "operator"] as const)(
  "運営による会員削除 / %s会員の削除はプレーンな実行者に結び付いた同じ状態と版で保存する",
  async (category) => {
    const fixture = setup();
    const cases =
      fixture.raw[
        ({ customer: "customers", business: "businesses", operator: "operators" } as const)[
          category
        ]
      ];
    const actor: AuthorizedActor = {
      ...operatorIdentity,
      service: "operator",
      platform: true,
      protectedRole: true,
      rolePermissions: PLATFORM_PERMISSIONS,
      accessSnapshot: { scope: PLATFORM_SCOPE, state: fixture.state },
    };
    await invokeRuntime(cases, "removeByOperator", [
      { identity: { ...actor }, accountId: `${category}:shared` },
    ]);
    expect(fixture.repository.load).not.toHaveBeenCalled();
    expect(fixture.repository.commit).toHaveBeenCalledWith(
      fixture.state.version,
      expect.any(Object),
      expect.objectContaining({ actorId: operatorIdentity.userId, scope: PLATFORM_SCOPE }),
    );
  },
);

it.each(["customer", "business", "operator"] as const)(
  "運営による会員削除 / %sの削除にはプラットフォームのuser.delete権限を要求する",
  async (category) => {
    const fixture = setup();
    fixture.query.grant.mockResolvedValue({
      active: true,
      permissions: ["user.read"],
      protectedRole: false,
    });
    let operation;
    if (category === "customer") {
      operation = fixture.customers.removeByOperator(operatorIdentity, customer.id);
    } else {
      if (category === "business") {
        operation = fixture.businesses.removeByOperator(operatorIdentity, business.id);
      } else {
        operation = fixture.operators.removeByOperator(operatorIdentity, operator.id);
      }
    }

    await expect(operation).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fixture.query.grant).toHaveBeenCalledWith(operatorIdentity.userId, PLATFORM_SCOPE);
    expect(fixture.repository.load).toHaveBeenCalledWith(PLATFORM_SCOPE);
    expect(fixture.repository.commit).not.toHaveBeenCalled();
  },
);

it("運営による会員削除 / 企業管理者による運営会員の削除を拒否する", async () => {
  const { operators, repository } = setup();
  await expect(
    operators.removeByOperator(identity("business", business.id), operator.id),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(repository.commit).not.toHaveBeenCalled();
});

it.each(["customer", "business", "operator"] as const)(
  "運営による会員削除 / %s会員が存在しなくても別サービスの会員を削除しない",
  async (category) => {
    const fixture = setup({
      customerAccounts: category === "customer" ? [] : [customer],
      businessAccounts: category === "business" ? [] : [business],
      operatorAccounts: category === "operator" ? [] : [operator],
    });
    let operation;
    if (category === "customer") {
      operation = fixture.customers.removeByOperator(operatorIdentity, customer.id);
    } else {
      if (category === "business") {
        operation = fixture.businesses.removeByOperator(operatorIdentity, business.id);
      } else {
        operation = fixture.operators.removeByOperator(operatorIdentity, operator.id);
      }
    }

    await expect(operation).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fixture.repository.commit).not.toHaveBeenCalled();
  },
);

it("運営による会員削除 / 保護対象の運営会員を削除するには保護対象の管理者であることを要求する", async () => {
  const { operators, repository, query } = setup(protectedMemberships());
  query.grant.mockResolvedValue({
    active: true,
    permissions: PLATFORM_PERMISSIONS,
    protectedRole: false,
  });
  query.hasQualifiedOwner.mockResolvedValue(true);
  await expect(operators.removeByOperator(operatorIdentity, operator.id)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(query.hasQualifiedOwner).not.toHaveBeenCalled();
  expect(repository.commit).not.toHaveBeenCalled();
});

it("運営による会員削除 / 運営が自分では付与できない権限を持つ会員を削除できない", async () => {
  const targetRole = new RoleEntity(
    AccessId.create("role:auditor"),
    PLATFORM,
    AccessName.create("監査担当"),
    ["audit.read"].map((value) => PermissionValue.create(value)),
    false,
  );
  const targetMembership = new MembershipEntity(
    AccessId.create("membership:auditor"),
    PLATFORM,
    operator.id,
    targetRole.id,
    AccountCategoryValue.create("operator"),
  );
  const { operators, repository, query } = setup({
    roles: [targetRole],
    memberships: [targetMembership],
  });
  query.grant.mockResolvedValue({
    active: true,
    permissions: ["user.delete"],
    protectedRole: false,
  });
  await expect(operators.removeByOperator(operatorIdentity, operator.id)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(repository.commit).not.toHaveBeenCalled();
});

it("運営による会員削除 / 運営による企業・運営会員の削除でも最後の管理者保護を維持する", async () => {
  const fixture = setup(protectedMemberships());
  await expect(
    fixture.businesses.removeByOperator(operatorIdentity, business.id),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(
    fixture.operators.removeByOperator(operatorIdentity, operator.id),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(fixture.query.hasQualifiedOwner.mock.calls).toEqual([
    [ORGANIZATION, "membership:owner"],
    [PLATFORM_SCOPE, "membership:administrator"],
  ]);
  expect(fixture.repository.commit).not.toHaveBeenCalled();
});

it("運営による会員削除 / 認可された運営の削除では指定された会員だけを無効な状態で保存する", async () => {
  const fixture = setup(protectedMemberships());
  fixture.query.hasQualifiedOwner.mockResolvedValue(true);
  await fixture.customers.removeByOperator(operatorIdentity, customer.id);
  await fixture.businesses.removeByOperator(operatorIdentity, business.id);
  await fixture.operators.removeByOperator(operatorIdentity, operator.id);
  const changes = fixture.repository.commit.mock.calls.map((props) => {
    const [, change] = props;
    return change;
  });
  expect(changes).toEqual([
    { withdrawnCustomerAccount: customer.withdraw() },
    { withdrawnBusinessAccount: business.withdraw() },
    { stoppedOperatorAccount: operator.stop() },
  ]);
  expect(
    fixture.repository.commit.mock.calls.map((props) => {
      const [, , audit] = props;
      return {
        actorId: audit.actorId,
        scope: audit.scope,
        action: audit.action,
        targetId: audit.targetId,
      };
    }),
  ).toEqual(
    [customer.id, business.id, operator.id].map((targetId) => ({
      actorId: operatorIdentity.userId,
      scope: PLATFORM_SCOPE,
      action: "account.delete",
      targetId,
    })),
  );
  expect(fixture.query.hasQualifiedOwner.mock.calls).toEqual([
    [ORGANIZATION, "membership:owner"],
    [PLATFORM_SCOPE, "membership:administrator"],
  ]);
});

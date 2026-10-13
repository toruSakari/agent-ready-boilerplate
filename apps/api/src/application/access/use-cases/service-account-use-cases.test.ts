import {
  hashInvitation,
  BusinessAccountEntity,
  CustomerAccountEntity,
  OperatorAccountEntity,
  PLATFORM_SCOPE,
  expect,
  it,
  AccountIdentityProvider,
  SUBJECT,
  EMAIL,
  ORGANIZATION,
  INVITATION_TOKEN,
  customer,
  business,
  operator,
  identity,
  setup,
  invited,
  protectedMemberships,
  entryPoints,
  channels,
} from "#api/application/access/use-cases/service-account-use-cases.test-fixture.ts";

it.each(entryPoints)(
  "サービス会員の操作入口の境界 / $nameの会員解決前に未検証のIdentityを拒否する",
  async (props) => {
    const fixture = setup();
    const unverified = identity(props.channel);
    const provider = new AccountIdentityProvider(
      { authenticate: async () => unverified },
      fixture.query,
    );
    await expect(
      provider.resolveActor(
        unverified,
        {
          service: props.channel === "admin" ? "operator" : props.channel,
          purpose: "registration",
        },
        ORGANIZATION,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fixture.query.resolveAccount).not.toHaveBeenCalled();
    expect(fixture.repository.load).not.toHaveBeenCalled();
    expect(fixture.repository.commit).not.toHaveBeenCalled();
  },
);

it.each(
  entryPoints.flatMap((entry) =>
    channels
      .filter((channel) => channel !== entry.channel)
      .map((channel) => ({ ...entry, rejectedChannel: channel })),
  ),
)(
  "サービス会員の操作入口の境界 / $nameでは会員状態を読み書きする前に$rejectedChannelを拒否する",
  async (props) => {
    const fixture = setup();
    await expect(
      (props.rejectedChannel === undefined ? props.rawCall : props.call)(
        fixture,
        identity(props.rejectedChannel),
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(fixture.repository.load).not.toHaveBeenCalled();
    expect(fixture.repository.findInvitation).not.toHaveBeenCalled();
    expect(fixture.repository.commit).not.toHaveBeenCalled();
    expect(fixture.query.resolveAccount).toHaveBeenCalledTimes(
      props.rejectedChannel === undefined ? 0 : 1,
    );
  },
);

it("サービス会員の操作入口の境界 / 同じ認証主体をサービスごとに独立した3つの会員IDへ解決する", async () => {
  const { customers, businesses, operators, query } = setup();
  await expect(customers.registration(identity("customer"))).resolves.toEqual({
    registered: true,
    category: "customer",
    accountId: customer.id,
  });
  await expect(businesses.registration(identity("business"))).resolves.toEqual({
    registered: true,
    category: "business",
    accountId: business.id,
  });
  await expect(operators.registration(identity("admin"))).resolves.toEqual({
    registered: true,
    category: "operator",
    accountId: operator.id,
  });
  expect(query.resolveAccount.mock.calls).toEqual([
    [SUBJECT, "customer"],
    [SUBJECT, "customer"],
    [SUBJECT, "business"],
    [SUBJECT, "business"],
    [SUBJECT, "operator"],
    [SUBJECT, "operator"],
  ]);
});

it("サービス会員の操作入口の境界 / 別サービスの会員を通常会員の登録済み状態として扱わない", async () => {
  const { customers, repository } = setup({ customerAccounts: [] });
  await expect(customers.registration(identity("customer"))).resolves.toEqual({
    registered: false,
    category: "customer",
    accountId: null,
  });
  expect(repository.commit).not.toHaveBeenCalled();
});

it("サービスごとに独立した会員登録 / 同じ認証主体に企業・運営の会員がいても通常会員だけを登録する", async () => {
  const { customers, repository, state } = setup({
    customerAccounts: [],
    ...protectedMemberships(),
  });
  const result = await customers.register(identity("customer"), { name: "新しい通常会員" });
  const change = repository.commit.mock.calls[0]![1];
  expect(Object.keys(change)).toEqual(["customerAccounts"]);
  expect(change.customerAccounts).toHaveLength(1);
  expect(change.customerAccounts![0]).toBeInstanceOf(CustomerAccountEntity);
  expect(change.customerAccounts![0]).toMatchObject({
    id: result.accountId,
    status: "active",
    category: "customer",
    subjectId: SUBJECT,
    email: EMAIL,
  });
  expect(result.accountId).not.toBe(business.id);
  expect(result.accountId).not.toBe(operator.id);
  expect(state.memberships).toHaveLength(2);
  expect(repository.commit).toHaveBeenCalledWith(
    state.version,
    change,
    expect.objectContaining({
      action: "account.register",
      actorId: result.accountId,
      targetId: result.accountId,
      scope: "customer",
    }),
  );
});

it("サービスごとに独立した会員登録 / 有効な通常会員の重複登録を拒否し、退会済みなら新しいIDで登録する", async () => {
  const duplicate = setup();
  await expect(
    duplicate.customers.register(identity("customer"), { name: "再登録" }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(duplicate.repository.commit).not.toHaveBeenCalled();
  const withdrawn = setup({ customerAccounts: [customer.withdraw()] });
  const result = await withdrawn.customers.register(identity("customer"), { name: "再登録" });
  expect(result.accountId).not.toBe(customer.id);
  expect(Object.keys(withdrawn.repository.commit.mock.calls[0]![1])).toEqual(["customerAccounts"]);
});

it("サービスごとに独立した会員登録 / 企業・運営には招待経由の登録だけを公開し、直接登録の操作を公開しない", () => {
  const { businesses, operators } = setup();
  expect(businesses).not.toHaveProperty("register");
  expect(operators).not.toHaveProperty("register");
  expect(operators).not.toHaveProperty("withdraw");
});

it.each(["business", "operator"] as const)(
  "サービスごとに独立した会員登録 / %sの登録前に有効な招待を要求する",
  async (category) => {
    const fixture = setup({ businessAccounts: [], operatorAccounts: [] });
    const input = { token: "missing", name: "担当者" };
    const operation =
      category === "business"
        ? fixture.businesses.registerFromInvitation(identity("business"), input)
        : fixture.operators.registerFromInvitation(identity("admin"), input);
    await expect(operation).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fixture.repository.findInvitation).toHaveBeenCalledWith(
      await hashInvitation(input.token),
    );
    expect(fixture.repository.commit).not.toHaveBeenCalled();
  },
);

it("サービスごとに独立した会員登録 / 招待された企業担当者とその企業所属だけを作成する", async () => {
  const { businesses, repository, invitation } = await invited("business", {
    businessAccounts: [],
  });
  await businesses.registerFromInvitation(identity("business"), {
    token: INVITATION_TOKEN,
    name: "企業担当者",
  });
  const change = repository.commit.mock.calls[0]![1];
  expect(Object.keys(change).sort()).toEqual([
    "businessAccounts",
    "memberships",
    "removeInvitationIds",
  ]);
  const account = change.businessAccounts![0]!;
  expect(account).toBeInstanceOf(BusinessAccountEntity);
  expect(account).toMatchObject({ category: "business", status: "active", subjectId: SUBJECT });
  expect(account.id).not.toBe(customer.id);
  expect(account.id).not.toBe(operator.id);
  expect(change.memberships).toEqual([
    expect.objectContaining({
      userId: account.id,
      category: "business",
      scope: ORGANIZATION,
      roleId: invitation.roleId,
    }),
  ]);
  expect(change.removeInvitationIds).toEqual([invitation.id]);
});

it("サービスごとに独立した会員登録 / 招待された運営会員とそのプラットフォーム所属だけを作成する", async () => {
  const { operators, repository, invitation } = await invited("operator", {
    operatorAccounts: [],
  });
  await operators.registerFromInvitation(identity("admin"), {
    token: INVITATION_TOKEN,
    name: "運営担当者",
  });
  const change = repository.commit.mock.calls[0]![1];
  expect(Object.keys(change).sort()).toEqual([
    "memberships",
    "operatorAccounts",
    "removeInvitationIds",
  ]);
  const account = change.operatorAccounts![0]!;
  expect(account).toBeInstanceOf(OperatorAccountEntity);
  expect(account).toMatchObject({ category: "operator", status: "active", subjectId: SUBJECT });
  expect(account.id).not.toBe(customer.id);
  expect(account.id).not.toBe(business.id);
  expect(change.memberships).toEqual([
    expect.objectContaining({
      userId: account.id,
      category: "operator",
      scope: PLATFORM_SCOPE,
      roleId: invitation.roleId,
    }),
  ]);
  expect(change.removeInvitationIds).toEqual([invitation.id]);
});

it.each([
  ["customer", "business"],
  ["customer", "operator"],
  ["business", "customer"],
  ["business", "operator"],
  ["operator", "customer"],
  ["operator", "business"],
] as const)(
  "サービスごとに独立した会員登録 / %s向けの招待を%sのサービスでは拒否する",
  async (invitationCategory, target) => {
    const fixture = await invited(invitationCategory);
    const input = { token: INVITATION_TOKEN, name: "担当者" };
    let operation;
    if (target === "customer") {
      operation = fixture.customers.acceptInvitation(identity("customer"), input);
    } else {
      if (target === "business") {
        operation = fixture.businesses.registerFromInvitation(identity("business"), input);
      } else {
        operation = fixture.operators.registerFromInvitation(identity("admin"), input);
      }
    }

    await expect(operation).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fixture.repository.commit).not.toHaveBeenCalled();
  },
);

it.each([
  { permissions: ["user.delete"] as const, protectedRole: false },
  { permissions: ["order:read"] as const, protectedRole: true },
])(
  "サービスごとに独立した会員登録 / 通常会員の権限を超える招待ロールを拒否する：保護対象=$protectedRole、権限=$permissions",
  async (props) => {
    const { customers, repository } = await invited(
      "customer",
      {},
      props.permissions,
      props.protectedRole,
    );
    await expect(
      customers.acceptInvitation(identity("customer"), { token: INVITATION_TOKEN, name: "会員" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.commit).not.toHaveBeenCalled();
  },
);

it.each(["customer", "business", "operator"] as const)(
  "本人によるサービスごとの退会・停止 / 本人確認済みの認証主体が異なる場合は%sの退会・停止を拒否する",
  async (category) => {
    const fixture = setup();
    const actor = {
      ...identity(category === "operator" ? "admin" : category, `${category}:shared`),
      subjectId: "clerk:different-person",
    };
    let operation;
    if (category === "customer") {
      operation = fixture.customers.withdraw(actor);
    } else {
      if (category === "business") {
        operation = fixture.businesses.withdraw(actor);
      } else {
        operation = fixture.operators.stop(actor);
      }
    }

    await expect(operation).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fixture.repository.commit).not.toHaveBeenCalled();
    expect(fixture.query.hasQualifiedOwner).not.toHaveBeenCalled();
  },
);

it("本人によるサービスごとの退会・停止 / 他サービスの最後の管理者保護を確認せずに通常会員を退会させる", async () => {
  const { customers, repository, query, state } = setup(protectedMemberships());
  await expect(customers.withdraw(identity("customer", customer.id))).resolves.toEqual({
    category: "customer",
  });
  const change = repository.commit.mock.calls[0]![1];
  expect(Object.keys(change)).toEqual(["withdrawnCustomerAccount"]);
  expect(change.withdrawnCustomerAccount).toBeInstanceOf(CustomerAccountEntity);
  expect(change.withdrawnCustomerAccount).toMatchObject({
    id: customer.id,
    status: "withdrawn",
    email: null,
  });
  expect(query.resolveAccount).toHaveBeenCalledWith(SUBJECT, "customer");
  expect(query.hasQualifiedOwner).not.toHaveBeenCalled();
  expect(state.businessAccounts[0]).toBe(business);
  expect(state.operatorAccounts[0]).toBe(operator);
  expect(business.status).toBe("active");
  expect(operator.status).toBe("active");
});

it("本人によるサービスごとの退会・停止 / 企業所属だけを確認し、最後の企業オーナーを保護する", async () => {
  const { businesses, repository, query } = setup(protectedMemberships());
  await expect(businesses.withdraw(identity("business", business.id))).rejects.toMatchObject({
    code: "CONFLICT",
  });
  expect(query.hasQualifiedOwner.mock.calls).toEqual([[ORGANIZATION, "membership:owner"]]);
  expect(repository.commit).not.toHaveBeenCalled();
});

it("本人によるサービスごとの退会・停止 / プラットフォーム所属だけを確認し、最後の運営管理者を保護する", async () => {
  const { operators, repository, query } = setup(protectedMemberships());
  await expect(operators.stop(identity("admin", operator.id))).rejects.toMatchObject({
    code: "CONFLICT",
  });
  expect(query.hasQualifiedOwner.mock.calls).toEqual([
    [PLATFORM_SCOPE, "membership:administrator"],
  ]);
  expect(repository.commit).not.toHaveBeenCalled();
});

it("本人によるサービスごとの退会・停止 / オーナー保護の確認後に対象の企業担当者だけを退会させる", async () => {
  const { businesses, repository, query } = setup(protectedMemberships());
  query.hasQualifiedOwner.mockResolvedValue(true);
  await expect(businesses.withdraw(identity("business", business.id))).resolves.toEqual({
    category: "business",
  });
  const change = repository.commit.mock.calls[0]![1];
  expect(Object.keys(change)).toEqual(["withdrawnBusinessAccount"]);
  expect(change.withdrawnBusinessAccount).toBeInstanceOf(BusinessAccountEntity);
  expect(change.withdrawnBusinessAccount).toMatchObject({
    id: business.id,
    status: "withdrawn",
    email: null,
  });
  expect(query.resolveAccount).toHaveBeenCalledWith(SUBJECT, "business");
  expect(query.hasQualifiedOwner.mock.calls).toEqual([[ORGANIZATION, "membership:owner"]]);
  expect(customer.status).toBe("active");
  expect(operator.status).toBe("active");
});

it("本人によるサービスごとの退会・停止 / 管理者保護の確認後に対象の運営会員だけを停止する", async () => {
  const { operators, repository, query } = setup(protectedMemberships());
  query.hasQualifiedOwner.mockResolvedValue(true);
  await expect(operators.stop(identity("admin", operator.id))).resolves.toEqual({
    category: "operator",
  });
  const change = repository.commit.mock.calls[0]![1];
  expect(Object.keys(change)).toEqual(["stoppedOperatorAccount"]);
  expect(change.stoppedOperatorAccount).toBeInstanceOf(OperatorAccountEntity);
  expect(change.stoppedOperatorAccount).toMatchObject({
    id: operator.id,
    status: "stopped",
    email: null,
  });
  expect(query.resolveAccount).toHaveBeenCalledWith(SUBJECT, "operator");
  expect(query.hasQualifiedOwner.mock.calls).toEqual([
    [PLATFORM_SCOPE, "membership:administrator"],
  ]);
  expect(customer.status).toBe("active");
  expect(business.status).toBe("active");
});

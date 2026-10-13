import { AccessRegisterCustomerInputDto } from "#api/application/access/dtos/access-register-customer-input-dto.ts";
import { AccessDeleteUserInputDto } from "#api/application/access/dtos/access-delete-user-input-dto.ts";
// @vitest-environment node
import {
  CHANNEL_SERVICES,
  platform,
  repository,
  query,
  access,
  rawAccess,
  provider,
  authenticate,
  operator,
  channelFor,
  account,
  memberships,
  addAccount,
  addMembership,
  register,
  inviteAndAccept,
} from "#api/infrastructure/auth/providers/service-account-lifecycles.integration.test-fixture.ts";
import { expect, it } from "vite-plus/test";
import { authenticateActor } from "#api/test/authorized-actor.ts";
import { prepareAuthorizedActor } from "#api/application/auth/policies/prepare-authorized-actor.ts";

it.each([
  ["demo-member", "business", "customer"],
  ["demo-member", "business", "admin"],
  ["demo-customer", "customer", "business"],
  ["demo-customer", "customer", "admin"],
] as const)(
  "独立した会員IDによる認証境界 / %sは%sから%sへURLを変えても登録されない",
  async (subjectId, own, other) => {
    await expect(authenticate(subjectId, own, "demo-store")).resolves.toMatchObject({
      userId: `${own}:${subjectId}`,
      subjectId,
      channel: own,
      tenantId: "demo-store",
    });
    for (const scope of [undefined, "demo-store"]) {
      for (const procedure of ["access.session", "health", "order.list"]) {
        await expect(authenticate(subjectId, other, scope, procedure)).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
      }
    }

    const onboarding = await authenticate(subjectId, other, undefined, "access.registration");
    expect(await access.registration(onboarding)).toMatchObject({
      registered: false,
      accountId: null,
      category: other === "admin" ? "operator" : other,
    });
  },
);
it("独立した会員IDによる認証境界 / 同じ認証主体でも三種類の会員ID・所属・プロフィールは独立する", async () => {
  const identities = await Promise.all(
    (["customer", "business", "admin"] as const).map((channel) =>
      authenticate("demo-user", channel),
    ),
  );
  expect(new Set(identities.map((identity) => identity.userId)).size).toBe(3);
  expect(identities.map((identity) => identity.subjectId)).toEqual([
    "demo-user",
    "demo-user",
    "demo-user",
  ]);
  for (const identity of identities) {
    expect(identity.userId).not.toBe(identity.subjectId);
    expect(await access.registration(identity)).toMatchObject({
      registered: true,
      accountId: identity.userId,
    });
  }

  for (const channel of ["business", "customer"] as const) {
    for (const scope of ["demo-store", "demo-second"]) {
      await expect(authenticate("demo-user", channel, scope)).resolves.toMatchObject({
        userId: `${channel}:demo-user`,
        tenantId: scope,
      });
    }
  }
});
it("独立した会員IDによる認証境界 / 運営登録だけでは他のサービスに登録されず、顧客権限へフォールバックしない", async () => {
  const subjectId = "operator-only";
  const id = await addAccount(subjectId, "operator");
  await addMembership(id, "operator", "platform", "platform:assistant");
  await expect(authenticate(subjectId, "admin")).resolves.toMatchObject({ userId: id });
  for (const channel of ["business", "customer"] as const) {
    await expect(authenticate(subjectId, channel)).rejects.toMatchObject({ code: "FORBIDDEN" });
  }

  const identity = await authenticate("demo-user", "admin", "demo-store");
  expect(identity.permissions).toEqual([]);
  expect(await access.session(identity)).toMatchObject({
    permissions: [],
    organizations: [],
    platformPermissions: expect.arrayContaining(["organization.manage"]),
  });
});
it("独立した会員IDによる認証境界 / 登録済みで所属がない会員はログインできるが企業を選択できない", async () => {
  await platform.env.DB.prepare(
    "DELETE FROM business_memberships WHERE business_accounts_id='business:demo-member'",
  ).run();
  const identity = await authenticate("demo-member", "business");
  expect(await access.session(identity)).toMatchObject({
    organizations: [],
    permissions: [],
  });
  await expect(authenticate("demo-member", "business", "demo-store")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
it("独立した会員IDによる認証境界 / 企業担当者の所属を限定し、一般ユーザーの旧オーナー所属を認可に使わない", async () => {
  await platform.env.DB.prepare(
    "INSERT INTO customer_memberships (id,organizations_id,customer_accounts_id,access_roles_id) VALUES ('customer:legacy-owner','demo-store','customer:demo-customer','demo-store:owner')",
  ).run();
  const customer = await authenticate("demo-customer", "customer", "demo-store");
  expect(customer.permissions).not.toContain("member.read");
  expect(customer.permissions).not.toContain("product.update");
  expect((await access.session(customer)).permissions).not.toContain("member.read");
  await expect(access.listMembers(customer, "demo-store")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  for (const channel of ["business", "admin"] as const) {
    await expect(authenticate("demo-customer", channel, "demo-store")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  }

  await expect(authenticate("demo-member", "business", "demo-second")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(authenticate("demo-member", "business", "platform")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
it("独立した会員IDによる認証境界 / デモの管理者ヘッダーや認証プロバイダーの企業IDは登録と所属を上書きしない", async () => {
  for (const channel of ["business", "admin"] as const) {
    await expect(
      authenticateActor(
        provider,
        new Request("http://localhost/api/trpc/access.session", {
          headers: {
            "x-demo-user": "demo-customer",
            "x-demo-role": "admin",
            "x-demo-tenant": "demo-store",
            "x-organization-id": "demo-store",
          },
        }),
        { service: CHANNEL_SERVICES[channel] },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  }
});
it.each([
  ["所属解除", "DELETE FROM business_memberships WHERE id='business:demo-store:demo-member'"],
  ["企業停止", "UPDATE organizations SET active=0 WHERE id='demo-store'"],
] as const)(
  "独立した会員IDによる認証境界 / %sを次の企業認証に反映し、会員登録は残す",
  async (_reason, mutation) => {
    await authenticate("demo-member", "business", "demo-store");
    await platform.env.DB.prepare(mutation).run();
    await expect(authenticate("demo-member", "business", "demo-store")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(
      (await access.session(await authenticate("demo-member", "business"))).organizations,
    ).toEqual([]);
  },
);
it("独立した会員IDによる認証境界 / 会員の論理削除は企業未選択でも即時拒否する", async () => {
  await platform.env.DB.prepare(
    "UPDATE business_accounts SET deleted=1 WHERE id='business:demo-member'",
  ).run();
  for (const scope of [undefined, "demo-store"]) {
    await expect(authenticate("demo-member", "business", scope)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  }
});
it("顧客の明示登録・退会・再登録 / 企業会員の顧客登録は新しい顧客行だけを作り、所属や他サービスの権限を作らない", async () => {
  const businessBefore = await memberships("business:demo-member", "business");
  const customer = await register("demo-member", "member@example.com");
  expect(customer.userId).toMatch(/^customer:/);
  expect(customer.userId).not.toBe("business:demo-member");
  expect(await account("demo-member", "customer")).toMatchObject({
    id: customer.userId,
    subject_id: "demo-member",
    email: "member@example.com",
    name: "登録した顧客",
    deleted: 0,
  });
  expect(await memberships(customer.userId, "customer")).toEqual([]);
  expect((await access.session(customer)).organizations).toEqual([]);
  expect(await memberships("business:demo-member", "business")).toEqual(businessBefore);
  expect(await account("demo-member", "operator")).toBeNull();
  await access.withdraw(customer);
  await expect(authenticate("demo-member", "customer")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(authenticate("demo-member", "business", "demo-store")).resolves.toMatchObject({
    userId: "business:demo-member",
  });
  expect(await memberships("business:demo-member", "business")).toEqual(businessBefore);
});
it("顧客の明示登録・退会・再登録 / 登録には顧客会員・確認済み主体ID・確認済みメールを要求する", async () => {
  const identity = await authenticate(
    "new-customer",
    "customer",
    undefined,
    "access.registerCustomer",
    "new@example.com",
  );
  const actor = await prepareAuthorizedActor(provider, identity, []);
  await expect(
    rawAccess.registerCustomer(
      AccessRegisterCustomerInputDto.parse({
        identity: { ...actor, email: undefined },
        input: { name: "未確認" },
      }),
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    rawAccess.registerCustomer(
      AccessRegisterCustomerInputDto.parse({
        identity: { ...actor, subjectId: undefined },
        input: { name: "主体なし" },
      }),
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  for (const channel of ["business", "admin"] as const) {
    await expect(
      rawAccess.registerCustomer(
        AccessRegisterCustomerInputDto.parse({
          identity: { ...actor, channel, service: CHANNEL_SERVICES[channel] },
          input: { name: "会員種別変更" },
        }),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  }

  expect(await account("new-customer", "customer")).toBeNull();
});
it("顧客の明示登録・退会・再登録 / 同じメールでも別の認証主体は別の一般ユーザーとなり企業所属を作らない", async () => {
  const identity = await register("different-subject", "customer@example.com");
  expect(identity.userId).not.toBe("customer:demo-customer");
  expect(await memberships(identity.userId, "customer")).toEqual([]);
  expect(await memberships("customer:demo-customer", "customer")).toEqual([]);
  const selected = await authenticate("different-subject", "customer", "demo-store");
  expect(selected.userId).toBe(identity.userId);
  expect((await access.session(selected)).organizations).toEqual([]);
});
it("顧客の明示登録・退会・再登録 / 繰り返し・同時登録は一つだけ成功し既存プロフィールを書き換えない", async () => {
  const identity = await authenticate(
    "concurrent-customer",
    "customer",
    undefined,
    "access.registerCustomer",
    "concurrent@example.com",
  );
  const results = await Promise.allSettled([
    access.registerCustomer(identity, { name: "最初" }),
    access.registerCustomer(identity, { name: "二番目" }),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const failure = results.find((result) => result.status === "rejected");
  expect(failure).toMatchObject({ status: "rejected", reason: { code: "CONFLICT" } });
  const stored = await account("concurrent-customer", "customer");
  await expect(access.registerCustomer(identity, { name: "再試行" })).rejects.toMatchObject({
    code: "CONFLICT",
  });
  expect(await account("concurrent-customer", "customer")).toEqual(stored);
  expect(
    (
      await platform.env.DB.prepare(
        "SELECT id FROM customer_accounts WHERE subject_id='concurrent-customer'",
      ).all()
    ).results,
  ).toHaveLength(1);
});
it.each(["business", "operator"] as const)(
  "顧客の明示登録・退会・再登録 / %s退会は同一認証主体の他サービスを残す",
  async (category) => {
    const subjectId = `withdraw-${category}`;
    const customer = await register(subjectId);
    const business = await inviteAndAccept(subjectId, "business");
    const operatorIdentity = await inviteAndAccept(subjectId, "operator", "platform");
    const target = category === "business" ? business : operatorIdentity;
    await access.withdraw(target);
    expect(await account(subjectId, category)).toBeNull();
    expect(await memberships(target.userId, category)).toEqual([]);
    await expect(authenticate(subjectId, channelFor(category))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(authenticate(subjectId, "customer")).resolves.toMatchObject({
      userId: customer.userId,
    });
    await expect(
      authenticate(subjectId, category === "business" ? "admin" : "business"),
    ).resolves.toMatchObject({
      userId: category === "business" ? operatorIdentity.userId : business.userId,
    });
  },
);
it("顧客の明示登録・退会・再登録 / 運営削除も指定された会員ID一つだけに作用する", async () => {
  const customer = await register("demo-member", "member@example.com");
  await access.deleteUser(await operator(), customer.userId);
  expect(await account("demo-member", "customer")).toBeNull();
  await expect(authenticate("demo-member", "business", "demo-store")).resolves.toMatchObject({
    userId: "business:demo-member",
  });
  await expect(access.deleteUser(await operator(), "demo-member")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
it.each(["customer", "business", "operator"] as const)(
  "顧客の明示登録・退会・再登録 / %sの運営削除は認可済みスナップショット取得後の運営所属解除と競合して会員を残す",
  async (category) => {
    const targetId = await addAccount("concurrent-removal-target", category);
    const alternativeId = await addAccount("alternative-operator", "operator");
    await addMembership(alternativeId, "operator", "platform", "platform:admin");
    const admin = await operator();
    const state = await repository.load("platform");
    const actor = await prepareAuthorizedActor(provider, admin, ["user.delete"], {
      scope: "platform",
      state,
    });
    await access.removeMember(admin, {
      scope: "platform",
      membershipId: "operator:platform:demo-user",
    });
    await expect(
      rawAccess.deleteUser(AccessDeleteUserInputDto.parse({ identity: actor, userId: targetId })),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await account("concurrent-removal-target", category)).toMatchObject({
      id: targetId,
      deleted: 0,
    });
    expect(await memberships(admin.userId, "operator")).toEqual([]);
    expect(
      (await query.audit("platform")).filter((entry) => entry.action === "account.delete"),
    ).toEqual([]);
  },
);

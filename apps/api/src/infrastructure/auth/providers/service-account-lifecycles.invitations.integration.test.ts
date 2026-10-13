import { ManageOrderInputDto } from "#api/application/order/dtos/manage-order-input-dto.ts";
import { ListOrdersInputDto } from "#api/application/order/dtos/list-orders-input-dto.ts";
import { D1OrderStatusRepository } from "#api/infrastructure/order/repositories/d1-order-status-repository.ts";
import { D1PaymentStateRepository } from "#api/infrastructure/payment/repositories/d1-payment-state-repository.ts";
// @vitest-environment node
import { orderReader } from "#api/test/order-reader.ts";
import {
  platform,
  repository,
  auditStore,
  query,
  access,
  provider,
  authenticate,
  operator,
  channelFor,
  account,
  memberships,
  invitation,
  register,
  inviteAndAccept,
} from "#api/infrastructure/auth/providers/service-account-lifecycles.integration.test-fixture.ts";
import { expect, it, vi } from "vite-plus/test";
import { ManageOrderUseCase } from "#api/application/order/use-cases/manage-order-use-case.ts";
import { ListOrdersUseCase } from "#api/application/order/use-cases/list-orders-use-case.ts";
import { OrderEntity } from "#api/domain/order/entities/order.ts";
import { DEMO_PLAN_CODES } from "#api/domain/access/policies/plan-catalog.ts";
import { D1OrderRepository } from "#api/infrastructure/order/repositories/d1-order-repository.ts";
import { orderValues } from "#api/test/domain-values.ts";
import { hashInvitation } from "#api/application/access/shared/invitation-token.ts";
import { prepareAuthorizedActor } from "#api/application/auth/policies/prepare-authorized-actor.ts";
import type { InventoryGateway } from "#api/application/order/gateways/inventory-gateway.ts";

it("顧客の明示登録・退会・再登録 / 退会しても注文・監査を保持し、新IDでの再登録は旧注文を所有しない", async () => {
  const previous = await authenticate("demo-customer", "customer", "demo-store");
  const orders = await historicalOrderFixture(previous.userId);
  await access.withdraw(previous);
  expect(
    await platform.env.DB.prepare("SELECT deleted,name,email FROM customer_accounts WHERE id=?")
      .bind(previous.userId)
      .first(),
  ).toEqual({ deleted: 1, name: "削除済みユーザー", email: null });
  const renewed = await register("demo-customer", "customer@example.com");
  expect(renewed.userId).not.toBe(previous.userId);
  expect(await memberships(renewed.userId, "customer")).toEqual([]);
  const selected = await authenticate("demo-customer", "customer", "demo-store");
  // 再登録した新しいサービス会員へ、退会した会員のプランを継承しない。
  expect(await query.plan({ category: "customer", id: renewed.userId })).toEqual({
    code: null,
    permissions: [],
  });
  await expect(prepareAuthorizedActor(provider, selected, ["order:read"])).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await access.changeCustomerPlan(selected, { planCode: DEMO_PLAN_CODES.customer });
  expect(
    await new ListOrdersUseCase(
      new D1OrderRepository(platform.env.DB),
      new D1PaymentStateRepository(platform.env.DB),
      new D1OrderStatusRepository(platform.env.DB),
    )
      .execute(
        ListOrdersInputDto.parse({
          identity: await prepareAuthorizedActor(provider, selected, ["order:read"]),
        }),
      )
      .then((result) => result.items),
  ).toEqual([]);
  await assertHistoricalOrderCannotBeCancelled(orders, selected);
  expect((await orders.find("demo-store", "historical-order"))?.toSnapshot().customerId).toBe(
    previous.userId,
  );
  expect(await orderReader(platform.env.DB).list("demo-store")).toHaveLength(1);
  expect(
    await platform.env.DB.prepare(
      "SELECT event_id FROM order_event_history WHERE order_id='historical-order'",
    ).first(),
  ).not.toBeNull();
  expect(
    (await query.audit("demo-store")).find((entry) => entry.id === "historical-audit")?.actorId,
  ).toBe(previous.userId);
});

async function assertWrongInvitationChannels(
  category: "business" | "operator",
  subjectId: string,
  email: string,
  token: string,
) {
  for (const channel of ["admin", "business", "customer"] as const) {
    if (channel === channelFor(category)) {
      continue;
    }

    const wrong = await authenticate(
      subjectId,
      channel,
      undefined,
      "access.acceptInvitation",
      email,
    );
    await expect(
      access.acceptInvitation(wrong, { token, name: "誤った入口" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await invitation(token)).not.toBeNull();
  }
}

it.each(["business", "customer", "operator"] as const)(
  "サービスを指定した招待の認証・権限・原子性 / %s招待は事業者・運営だけを登録し、一般ユーザー向け発行と誤った入口を拒否する",
  async (category) => {
    const subjectId = `invited-${category}`;
    const email = `${subjectId}@example.com`;
    const scope = category === "operator" ? "platform" : "demo-second";
    const roleId = category === "operator" ? "platform:assistant" : `${scope}:staff`;
    if (category === "customer") {
      await expect(
        access.invite(await operator(), {
          scope,
          email,
          roleId: `${scope}:staff`,
          actorKind: category,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await account(subjectId, "customer")).toBeNull();
      expect((await repository.load(scope)).invitations).toEqual([]);
      return;
    }

    const issued = await access.invite(await operator(), {
      scope,
      email,
      roleId,
      actorKind: category,
    });
    await assertWrongInvitationChannels(category, subjectId, email, issued.token);
    const identity = await authenticate(
      subjectId,
      channelFor(category),
      undefined,
      "access.acceptInvitation",
      email,
    );
    await access.acceptInvitation(identity, { token: issued.token, name: "招待された利用者" });
    const enrolled = await authenticate(subjectId, channelFor(category));
    expect(enrolled.userId).toMatch(new RegExp(`^${category}:`));
    expect(enrolled.userId).not.toBe(subjectId);
    expect(await memberships(enrolled.userId, category)).toHaveLength(1);
    expect(await invitation(issued.token)).toBeNull();
    for (const other of ["business", "customer", "operator"] as const) {
      if (other !== category) {
        expect(await account(subjectId, other)).toBeNull();
      }
    }

    await expect(
      access.acceptInvitation(identity, { token: issued.token, name: "再利用" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  },
);
it("サービスを指定した招待の認証・権限・原子性 / 同じ認証主体の別サービス招待は新しい会員とロールを作り既存ロールを変更しない", async () => {
  const customerBefore = await memberships("customer:demo-customer", "customer");
  const business = await inviteAndAccept(
    "demo-customer",
    "business",
    "demo-store",
    "customer@example.com",
  );
  expect(business.userId).not.toBe("customer:demo-customer");
  expect(await memberships("customer:demo-customer", "customer")).toEqual(customerBefore);
  expect(await memberships(business.userId, "business")).toEqual([
    expect.objectContaining({ access_roles_id: "demo-store:staff" }),
  ]);
  const selected = await authenticate("demo-customer", "business", "demo-store");
  expect(selected.permissions).not.toContain("member.invite");
  const customer = await authenticate("demo-customer", "customer", "demo-store");
  expect(customer.permissions).not.toContain("member.read");
  expect(await account("demo-customer", "operator")).toBeNull();
});
it("サービスを指定した招待の認証・権限・原子性 / 所属がすでにある会員への別ロール招待は承諾で暗黙に昇格しない", async () => {
  const issued = await access.invite(await operator(), {
    scope: "demo-store",
    email: "member@example.com",
    roleId: "demo-store:owner",
    actorKind: "business",
  });
  const before = await memberships("business:demo-member", "business");
  const identity = await authenticate(
    "demo-member",
    "business",
    undefined,
    "access.acceptInvitation",
    "member@example.com",
  );
  await expect(
    access.acceptInvitation(identity, { token: issued.token, name: "昇格しない" }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(await memberships("business:demo-member", "business")).toEqual(before);
  expect(await invitation(issued.token)).not.toBeNull();
});
it("サービスを指定した招待の認証・権限・原子性 / 同じサービスの招待を二回承諾しても会員・所属を重複させない", async () => {
  const input = {
    scope: "demo-store",
    email: "double@example.com",
    roleId: "demo-store:staff",
    actorKind: "business" as const,
  };
  const first = await access.invite(await operator(), input);
  const second = await access.invite(await operator(), input);
  const identity = await authenticate(
    "double",
    "business",
    undefined,
    "access.acceptInvitation",
    input.email,
  );
  await access.acceptInvitation(identity, { token: first.token, name: "一回目" });
  await expect(
    access.acceptInvitation(identity, { token: second.token, name: "二回目" }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  const enrolled = await authenticate("double", "business");
  expect(await memberships(enrolled.userId, "business")).toHaveLength(1);
  expect(
    (
      await platform.env.DB.prepare(
        "SELECT id FROM business_accounts WHERE subject_id='double'",
      ).all()
    ).results,
  ).toHaveLength(1);
  expect(await invitation(second.token)).not.toBeNull();
});
it("サービスを指定した招待の認証・権限・原子性 / 所属保存の失敗は会員・所属・招待消費・監査・更新番号をまとめて戻す", async () => {
  const issued = await access.invite(await operator(), {
    scope: "demo-second",
    email: "atomic@example.com",
    roleId: "demo-second:staff",
    actorKind: "business",
  });
  const identity = await authenticate(
    "atomic",
    "business",
    undefined,
    "access.acceptInvitation",
    "atomic@example.com",
  );
  const version = (await repository.load("platform")).version;
  await platform.env.DB.prepare(
    "CREATE TRIGGER reject_test_membership BEFORE INSERT ON business_memberships BEGIN SELECT RAISE(ABORT, 'membership write failed'); END",
  ).run();
  try {
    await expect(
      access.acceptInvitation(identity, { token: issued.token, name: "原子的な招待" }),
    ).rejects.toThrow();
  } finally {
    await platform.env.DB.prepare("DROP TRIGGER reject_test_membership").run();
  }

  expect(await account("atomic", "business")).toBeNull();
  expect((await repository.load("platform")).version).toBe(version);
  expect(await invitation(issued.token)).not.toBeNull();
  expect(
    (await query.audit("demo-second")).filter((entry) => entry.action === "invitation.accept"),
  ).toEqual([]);
  await access.acceptInvitation(identity, { token: issued.token, name: "再試行" });
  expect(await account("atomic", "business")).not.toBeNull();
});
it("サービスを指定した招待の認証・権限・原子性 / 事業者が発行した招待は同じ主体の運営アカウントに発行者を切り替えられない", async () => {
  const issuer = await authenticate("demo-user", "business", "demo-store");
  const issued = await access.invite(issuer, {
    scope: "demo-store",
    email: "issuer-channel@example.com",
    roleId: "demo-store:staff",
    actorKind: "business",
  });
  expect(
    await platform.env.DB.prepare(
      "SELECT inviter_id,inviter_channel FROM invitations WHERE token_hash=?",
    )
      .bind(await hashInvitation(issued.token))
      .first(),
  ).toEqual({ inviter_id: "business:demo-user", inviter_channel: "business" });
  await platform.env.DB.prepare(
    "DELETE FROM business_memberships WHERE id='business:demo-store:demo-user'",
  ).run();
  await expect(operator()).resolves.toMatchObject({ userId: "operator:demo-user" });
  const identity = await authenticate(
    "issuer-channel",
    "business",
    undefined,
    "access.acceptInvitation",
    "issuer-channel@example.com",
  );
  await expect(
    access.acceptInvitation(identity, { token: issued.token, name: "発行者の権限なし" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(await account("issuer-channel", "business")).toBeNull();
});
it.each(["membership", "account"] as const)(
  "サービスを指定した招待の認証・権限・原子性 / 発行者の%s失効後は未承諾招待を受け付けない",
  async (revocation) => {
    const issued = await access.invite(await operator(), {
      scope: "demo-second",
      email: "revoked@example.com",
      roleId: "demo-second:staff",
      actorKind: "business",
    });
    await platform.env.DB.prepare(
      revocation === "membership"
        ? "DELETE FROM operator_memberships WHERE operator_accounts_id='operator:demo-user'"
        : "UPDATE operator_accounts SET deleted=1 WHERE id='operator:demo-user'",
    ).run();
    const identity = await authenticate(
      "revoked",
      "business",
      undefined,
      "access.acceptInvitation",
      "revoked@example.com",
    );
    await expect(
      access.acceptInvitation(identity, { token: issued.token, name: "失効した招待" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await account("revoked", "business")).toBeNull();
  },
);
it("サービスを指定した招待の認証・権限・原子性 / 旧形式の宛先サービス未指定招待は会員も所属も作らない", async () => {
  const issued = await access.invite(await operator(), {
    scope: "demo-second",
    email: "legacy@example.com",
    roleId: "demo-second:staff",
    actorKind: "business",
  });
  await platform.env.DB.prepare(
    "UPDATE invitations SET actor_kind=NULL,inviter_channel=NULL",
  ).run();
  const identity = await authenticate(
    "legacy",
    "business",
    undefined,
    "access.acceptInvitation",
    "legacy@example.com",
  );
  await expect(
    access.acceptInvitation(identity, { token: issued.token, name: "旧招待" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(await account("legacy", "business")).toBeNull();
});
it("サービスを指定した招待の認証・権限・原子性 / 事業者招待権限で運営登録や企業作成はできない", async () => {
  const business = await authenticate("demo-user", "business", "demo-store");
  for (const scope of ["platform", "demo-store"]) {
    await expect(
      access.invite(business, {
        scope,
        email: "escalated@example.com",
        roleId: scope === "platform" ? "platform:admin" : "demo-store:owner",
        actorKind: "operator",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  }

  await expect(access.createOrganization(business, { name: "無許可の企業" })).rejects.toMatchObject(
    { code: "FORBIDDEN" },
  );
});

async function historicalOrderFixture(customerId: string) {
  const orders = new D1OrderRepository(platform.env.DB);
  const order = OrderEntity.draft(
    orderValues({
      id: "historical-order",
      tenantId: "demo-store",
      customerId,
      lines: [{ sku: "sku-1", name: "保持する商品", quantity: 1, unitPrice: 100 }],
      now: "2026-01-01T00:00:00.000Z",
      eventId: "historical-event",
    }),
  );
  await orders.save(order);
  await platform.env.DB.prepare(
    "INSERT INTO order_event_history(event_id,tenant_id,order_id,event_type,occurred_at,processed_at) VALUES('historical-processed','demo-store','historical-order','order.created','2026-01-01','2026-01-01')",
  ).run();
  await auditStore.appendAudit({
    id: "historical-audit",
    actorId: customerId,
    scope: "demo-store",
    action: "test.history",
    targetId: "historical-order",
    occurredAt: "2026-01-01T00:00:00.000Z",
  });
  return orders;
}

async function assertHistoricalOrderCannotBeCancelled(
  orders: D1OrderRepository,
  selected: Parameters<typeof prepareAuthorizedActor>[1],
) {
  const reserve = vi.fn<InventoryGateway["reserve"]>();
  const release = vi.fn<InventoryGateway["release"]>();
  const inventory: InventoryGateway = { reserve, release, cancel: vi.fn(), commit: vi.fn() };
  await expect(
    new ManageOrderUseCase(orders, inventory, { findBySkus: async () => [] }).execute(
      ManageOrderInputDto.parse({
        input: {
          identity: await prepareAuthorizedActor(provider, selected, ["order:update"]),
          id: "historical-order",
          version: 0,
          status: "cancelled",
        },
      }),
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(reserve).not.toHaveBeenCalled();
  expect(release).not.toHaveBeenCalled();
}

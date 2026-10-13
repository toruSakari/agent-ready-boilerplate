import { beforeEach, expect, it, vi } from "vite-plus/test";
import type { AccessQuery } from "#api/application/access/queries/access-query.ts";
import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { IdentityProvider } from "#api/application/auth/providers/identity-provider.ts";
import type { ServiceActor } from "#api/application/auth/contracts/service-actor.ts";
import {
  BUSINESS_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import { AccountIdentityProvider } from "#api/application/auth/providers/account-identity-provider.ts";
import { authenticateActor } from "#api/test/authorized-actor.ts";

const authenticate = vi.fn<IdentityProvider["authenticate"]>();
const access = {
  plans: vi.fn<AccessQuery["plans"]>().mockReturnValue([]),
  plan: vi.fn<AccessQuery["plan"]>().mockResolvedValue({ code: null, permissions: [] }),
  resolveAccount: vi.fn<AccessQuery["resolveAccount"]>(),
  isRegistered: vi.fn<AccessQuery["isRegistered"]>(),
  grant: vi.fn<AccessQuery["grant"]>(),
  invitationIsCurrent: vi.fn<AccessQuery["invitationIsCurrent"]>(),
  hasQualifiedOwner: vi.fn<AccessQuery["hasQualifiedOwner"]>(),
  qualified: vi.fn<AccessQuery["qualified"]>(),
  organizations: vi.fn<AccessQuery["organizations"]>(),
  audit: vi.fn<AccessQuery["audit"]>(),
};
const provider = new AccountIdentityProvider({ authenticate }, access);
const verifiedSubject: Identity = {
  userId: "subject-1",
  subjectId: "subject-1",
  tenantId: "",
  role: "member",
  permissions: [],
};

async function authenticateAccount(
  selection: ServiceActor = { service: "business" },
  scope = "org-1",
) {
  const identity = await authenticateActor(
    provider,
    new Request("https://example.test/api/trpc", { headers: { "x-organization-id": scope } }),
    selection,
  );
  // 認証時の照会履歴を消し、認可が独立して現在のDB状態を再確認することを測る。
  vi.clearAllMocks();
  return identity;
}

beforeEach(() => {
  vi.resetAllMocks();
  authenticate.mockResolvedValue(verifiedSubject);
  access.resolveAccount.mockImplementation(async (_subject, category) => ({
    id: `${category}:user-1`,
    deleted: false,
  }));
  access.isRegistered.mockResolvedValue(true);
  access.qualified.mockResolvedValue(true);
  access.grant.mockResolvedValue({
    active: true,
    protectedRole: true,
    permissions: BUSINESS_PERMISSIONS,
  });
});

it("リクエストの本人確認とサービス会員解決を分ける / 本人確認では会員や所属を照会せず変更できない本人情報だけを発行する", async () => {
  const request = new Request("https://example.test/api/trpc");
  const identity = await provider.authenticate(request);
  expect(authenticate).toHaveBeenCalledExactlyOnceWith(request);
  expect(identity).toEqual(verifiedSubject);
  expect(identity).not.toBe(verifiedSubject);
  expect(identity.permissions).not.toBe(verifiedSubject.permissions);
  expect(Object.isFrozen(identity)).toBe(true);
  expect(Object.isFrozen(identity.permissions)).toBe(true);
  expect(Reflect.set(identity, "subjectId", "foreign-subject")).toBe(false);
  expect(Reflect.set(identity.permissions, "0", "organization.manage")).toBe(false);
  expect(access.resolveAccount).not.toHaveBeenCalled();
  expect(access.isRegistered).not.toHaveBeenCalled();
  expect(access.grant).not.toHaveBeenCalled();
});

it("リクエストの本人確認とサービス会員解決を分ける / 一度の本人確認から複数サービスと企業を独立して解決できる", async () => {
  const request = new Request("https://example.test/api/trpc");
  const authenticated = await provider.authenticate(request);
  const [business, customer] = await Promise.all([
    provider.resolveActor(authenticated, { service: "business" }, "org-1"),
    provider.resolveActor(authenticated, { service: "customer" }, "org-2"),
  ]);
  expect(authenticate).toHaveBeenCalledExactlyOnceWith(request);
  expect(access.resolveAccount).toHaveBeenCalledWith("subject-1", "business");
  expect(access.resolveAccount).toHaveBeenCalledWith("subject-1", "customer");
  expect(access.grant).toHaveBeenCalledWith("business:user-1", "org-1");
  expect(access.grant).toHaveBeenCalledWith("customer:user-1", "org-2");
  expect(business).toMatchObject({
    userId: "business:user-1",
    channel: "business",
    tenantId: "org-1",
  });
  expect(customer).toMatchObject({
    userId: "customer:user-1",
    channel: "customer",
    tenantId: "org-2",
  });
  expect(business).not.toBe(customer);
  expect(authenticated).toEqual(verifiedSubject);
});

it("リクエストの本人確認とサービス会員解決を分ける / 本人確認で受け取った会員種別・企業・ロールでは会員を決めない", async () => {
  authenticate.mockResolvedValue({
    ...verifiedSubject,
    channel: "admin",
    tenantId: "forged-org",
    role: "admin",
    permissions: PLATFORM_PERMISSIONS,
  });
  access.grant.mockResolvedValue({
    active: true,
    protectedRole: false,
    permissions: ["order:read"],
  });
  const authenticated = await provider.authenticate(
    new Request("https://example.test/api/trpc", {
      headers: { "x-actor-kind": "operator", "x-organization-id": "forged-org" },
    }),
  );
  const identity = await provider.resolveActor(authenticated, { service: "customer" }, "org-1");
  expect(access.resolveAccount).toHaveBeenCalledExactlyOnceWith("subject-1", "customer");
  expect(identity).toMatchObject({
    userId: "customer:user-1",
    channel: "customer",
    tenantId: "org-1",
    role: "member",
    permissions: ["order:read"],
  });
});

it("リクエストの本人確認とサービス会員解決を分ける / 本人情報のコピーは会員のDB照会前に拒否する", async () => {
  const authenticated = await provider.authenticate(new Request("https://example.test/api/trpc"));
  await expect(
    provider.resolveActor({ ...authenticated }, { service: "business" }, "org-1"),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(access.resolveAccount).not.toHaveBeenCalled();
  expect(access.grant).not.toHaveBeenCalled();
});

it("リクエストの本人確認とサービス会員解決を分ける / 別プロバイダーの本人情報は会員のDB照会前に拒否する", async () => {
  const otherProvider = new AccountIdentityProvider({ authenticate }, access);
  const authenticated = await otherProvider.authenticate(
    new Request("https://example.test/api/trpc"),
  );
  await expect(
    provider.resolveActor(authenticated, { service: "business" }, "org-1"),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(access.resolveAccount).not.toHaveBeenCalled();
  expect(access.grant).not.toHaveBeenCalled();
});

it("リクエストの本人確認とサービス会員解決を分ける / 本人確認アダプターの戻り値自体は発行済みの本人情報として扱わない", async () => {
  await provider.authenticate(new Request("https://example.test/api/trpc"));
  await expect(
    provider.resolveActor(verifiedSubject, { service: "business" }, "org-1"),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(access.resolveAccount).not.toHaveBeenCalled();
});

it("リクエストの本人確認とサービス会員解決を分ける / 解決済み会員を本人情報として別サービスへ再解決しない", async () => {
  const identity = await authenticateAccount();
  await expect(provider.resolveActor(identity, { service: "operator" }, "")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(access.resolveAccount).not.toHaveBeenCalled();
});

it("リクエストの本人確認とサービス会員解決を分ける / 会員未解決の本人情報では空の権限要求も認可しない", async () => {
  const authenticated = await provider.authenticate(new Request("https://example.test/api/trpc"));
  await expect(provider.authorize(authenticated, [])).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(access.isRegistered).not.toHaveBeenCalled();
  expect(access.grant).not.toHaveBeenCalled();
});

it("リクエストの本人確認とサービス会員解決を分ける / 本人確認に失敗したリクエストでは会員を照会しない", async () => {
  authenticate.mockRejectedValueOnce(new Error("本人確認失敗"));
  await expect(provider.authenticate(new Request("https://example.test/api/trpc"))).rejects.toThrow(
    "本人確認失敗",
  );
  expect(access.resolveAccount).not.toHaveBeenCalled();
  expect(access.grant).not.toHaveBeenCalled();
});

it("解決で発行した会員だけを認可する / 本人確認とサービス会員解決から変更できないIdentityを発行する", async () => {
  const request = new Request("https://example.test/api/trpc", {
    headers: { "x-organization-id": "org-1" },
  });
  const identity = await authenticateActor(provider, request, { service: "business" });
  expect(authenticate).toHaveBeenCalledExactlyOnceWith(request);
  expect(access.resolveAccount).toHaveBeenCalledExactlyOnceWith("subject-1", "business");
  expect(identity).toMatchObject({
    userId: "business:user-1",
    subjectId: "subject-1",
    channel: "business",
    tenantId: "org-1",
    permissions: BUSINESS_PERMISSIONS,
  });
  expect(Object.isFrozen(identity)).toBe(true);
  expect(Object.isFrozen(identity.permissions)).toBe(true);
  expect(Reflect.set(identity, "tenantId", "org-2")).toBe(false);
  expect(Reflect.set(identity.permissions, "0", "organization.manage")).toBe(false);
});

it("解決で発行した会員だけを認可する / 権限・ロールを自己申告した未発行のIdentityをDB照会前に拒否する", async () => {
  await expect(
    provider.authorize(
      {
        ...verifiedSubject,
        userId: "business:user-1",
        channel: "business",
        tenantId: "org-1",
        role: "admin",
        permissions: BUSINESS_PERMISSIONS,
      },
      ["order:read"],
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(access.isRegistered).not.toHaveBeenCalled();
  expect(access.grant).not.toHaveBeenCalled();
});

it("解決で発行した会員だけを認可する / 認証済みIdentityと同じ内容のコピーも発行元の証明にならない", async () => {
  const identity = await authenticateAccount();
  await expect(provider.authorize({ ...identity }, ["order:read"])).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(access.isRegistered).not.toHaveBeenCalled();
  expect(access.grant).not.toHaveBeenCalled();
});

it("解決で発行した会員だけを認可する / 別のプロバイダーが発行したIdentityを受け入れない", async () => {
  const identity = await authenticateAccount();
  const otherProvider = new AccountIdentityProvider({ authenticate }, access);
  await expect(otherProvider.authorize(identity, [])).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(access.isRegistered).not.toHaveBeenCalled();
});

const required: readonly PermissionCode[] = ["order:read", "order:update"];

it("権限配列の認可はすべての権限を要求する / 同じ会員・企業の有効な所属がすべての要求を持つ場合だけ許可する", async () => {
  const business = await authenticateAccount();
  await expect(provider.authorize(business, required)).resolves.toMatchObject({
    identity: business,
    permissions: BUSINESS_PERMISSIONS,
    protectedRole: true,
    platform: false,
  });
  expect(access.isRegistered).toHaveBeenCalledExactlyOnceWith("business:user-1", "business");
  expect(access.qualified).toHaveBeenCalledExactlyOnceWith("business:user-1", "org-1", "business");
  expect(access.grant).toHaveBeenCalledExactlyOnceWith("business:user-1", "org-1");
  expect(authenticate).not.toHaveBeenCalled();
});

it.each<PermissionCode>(["order:read", "order:update"])(
  "権限配列の認可はすべての権限を要求する / %sだけを持っていても複数の要求を満たさない",
  async (permission) => {
    const business = await authenticateAccount();
    access.grant.mockResolvedValue({
      active: true,
      protectedRole: true,
      permissions: [permission],
    });
    await expect(provider.authorize(business, required)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  },
);

it("権限配列の認可はすべての権限を要求する / 権限スナップショットに残る権限では現在の所属から消えた権限を補えない", async () => {
  const business = await authenticateAccount();
  access.grant.mockResolvedValue({ active: true, protectedRole: true, permissions: [] });
  await expect(provider.authorize(business, ["order:read"])).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});

it("権限配列の認可はすべての権限を要求する / 認証時の権限が空でも現在の所属が持つ権限とロールを取得する", async () => {
  access.grant.mockResolvedValue({ active: true, protectedRole: false, permissions: [] });
  const business = await authenticateAccount();
  access.grant.mockResolvedValue({
    active: true,
    protectedRole: true,
    permissions: BUSINESS_PERMISSIONS,
  });
  await expect(provider.authorize(business, required)).resolves.toMatchObject({
    identity: { ...business, permissions: BUSINESS_PERMISSIONS, role: "admin" },
    permissions: BUSINESS_PERMISSIONS,
    protectedRole: true,
  });
  expect(business.permissions).toEqual([]);
  expect(business.role).toBe("member");
});

it("権限配列の認可はすべての権限を要求する / 空の要求配列も有効なサービス会員と現在の所属を確認する", async () => {
  const business = await authenticateAccount();
  await expect(provider.authorize(business, [])).resolves.toMatchObject({
    permissions: BUSINESS_PERMISSIONS,
  });
  expect(access.isRegistered).toHaveBeenCalledExactlyOnceWith("business:user-1", "business");
  expect(access.qualified).toHaveBeenCalledExactlyOnceWith("business:user-1", "org-1", "business");
  expect(access.grant).toHaveBeenCalledExactlyOnceWith("business:user-1", "org-1");
});

it.each([{ requiredPermissions: [] }, { requiredPermissions: ["order:read"] }] as const)(
  "権限配列の認可はすべての権限を要求する / 退会済みの会員は権限要求$requiredPermissionsでも拒否する",
  async (props) => {
    const business = await authenticateAccount();
    access.isRegistered.mockResolvedValue(false);
    await expect(provider.authorize(business, props.requiredPermissions)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(access.grant).not.toHaveBeenCalled();
  },
);

it("権限配列の認可はすべての権限を要求する / 所属資格が取り消された後は古い権限で操作できない", async () => {
  const business = await authenticateAccount();
  access.qualified.mockResolvedValue(false);
  await expect(provider.authorize(business, required)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(access.grant).not.toHaveBeenCalled();
});

it.each([null, { active: false, protectedRole: true, permissions: BUSINESS_PERMISSIONS }])(
  "権限配列の認可はすべての権限を要求する / 削除・無効化された所属権限%sは許可しない",
  async (grant) => {
    const business = await authenticateAccount();
    access.grant.mockResolvedValue(grant);
    await expect(provider.authorize(business, required)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  },
);

it.each([null, { active: false, protectedRole: true, permissions: BUSINESS_PERMISSIONS }])(
  "権限ガードは会員種別と企業の境界を維持する / 存在しないか無効な所属%sでは会員を解決しない",
  async (grant) => {
    access.grant.mockResolvedValue(grant);
    const authenticated = await provider.authenticate(new Request("https://example.test/api/trpc"));
    await expect(
      provider.resolveActor(authenticated, { service: "business" }, "org-1"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(access.grant).toHaveBeenCalledExactlyOnceWith("business:user-1", "org-1");
  },
);

it("権限ガードは会員種別と企業の境界を維持する / 有効な所属権限が残っていてもサービス資格を失った会員は解決しない", async () => {
  access.qualified.mockResolvedValue(false);
  const authenticated = await provider.authenticate(new Request("https://example.test/api/trpc"));
  await expect(
    provider.resolveActor(authenticated, { service: "business" }, "org-1"),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it.each([null, { id: "deleted-user", deleted: true }])(
  "権限ガードは会員種別と企業の境界を維持する / 対象サービスの会員が未登録・削除済み%sなら別サービスへ切り替えない",
  async (account) => {
    access.resolveAccount.mockResolvedValue(account);
    const authenticated = await provider.authenticate(new Request("https://example.test/api/trpc"));
    await expect(
      provider.resolveActor(authenticated, { service: "customer" }, "org-1"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(access.resolveAccount).toHaveBeenCalledExactlyOnceWith("subject-1", "customer");
    expect(access.grant).not.toHaveBeenCalled();
  },
);

it.each([null, { active: false, protectedRole: true, permissions: BUSINESS_PERMISSIONS }])(
  "権限ガードは会員種別と企業の境界を維持する / 現在の所属%sが利用できなければ空の権限要求も認可しない",
  async (grant) => {
    const business = await authenticateAccount();
    access.grant.mockResolvedValue(grant);
    await expect(provider.authorize(business, [])).rejects.toMatchObject({ code: "FORBIDDEN" });
  },
);

it("権限ガードは会員種別と企業の境界を維持する / 別サービスだけに登録された会員IDを流用しない", async () => {
  const customer = await authenticateAccount({ service: "customer" });
  access.isRegistered.mockImplementation(
    async (userId, category) => userId === "business:user-1" && category === "business",
  );
  await expect(provider.authorize(customer, ["order:read"])).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(access.isRegistered).toHaveBeenCalledExactlyOnceWith("customer:user-1", "customer");
  expect(access.grant).not.toHaveBeenCalled();
});

it("権限ガードは会員種別と企業の境界を維持する / 別企業の有効な権限を対象企業へ流用しない", async () => {
  const business = await authenticateAccount({ service: "business" }, "org-2");
  access.grant.mockImplementation(async (_userId, scope) =>
    scope === "org-1"
      ? { active: true, protectedRole: true, permissions: BUSINESS_PERMISSIONS }
      : null,
  );
  await expect(provider.authorize(business, ["order:read"])).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(access.grant).toHaveBeenCalledExactlyOnceWith("business:user-1", "org-2");
});

it("権限ガードは会員種別と企業の境界を維持する / 企業未選択では権限のある企業を推測しない", async () => {
  const business = await authenticateAccount({ service: "business" }, "");
  await expect(provider.authorize(business, ["order:read"])).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(access.grant).not.toHaveBeenCalled();
});

it.each([
  ["customer", "product.update"],
  ["business", "organization.manage"],
  ["operator", "order:create"],
] as const)(
  "権限ガードは会員種別と企業の境界を維持する / %sの所属へ範囲外の%sが混入してもサービス上限を超えない",
  async (service, permission) => {
    const identity = await authenticateAccount({ service });
    access.grant.mockResolvedValue({
      active: true,
      protectedRole: true,
      permissions: [permission],
    });
    await expect(provider.authorize(identity, [permission])).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  },
);

it("権限ガードは会員種別と企業の境界を維持する / 顧客の許可された複数権限は顧客会員と企業で確認する", async () => {
  access.grant.mockResolvedValue({
    active: true,
    protectedRole: false,
    permissions: CUSTOMER_PERMISSIONS,
  });
  const customer = await authenticateAccount({ service: "customer" });
  await expect(provider.authorize(customer, ["order:read", "product.read"])).resolves.toMatchObject(
    {
      permissions: CUSTOMER_PERMISSIONS,
      protectedRole: false,
      platform: false,
    },
  );
  expect(access.grant).toHaveBeenCalledExactlyOnceWith("customer:user-1", "org-1");
});

it("権限ガードは会員種別と企業の境界を維持する / 運営は空のIdentity.permissionsを維持し企業ヘッダーでなくplatformを参照する", async () => {
  access.grant.mockImplementation(async (_userId, scope) =>
    scope === "platform"
      ? { active: true, protectedRole: true, permissions: PLATFORM_PERMISSIONS }
      : null,
  );
  const operator = await authenticateAccount({ service: "operator" }, "foreign-org");
  await expect(
    provider.authorize(operator, ["organization.read", "user.read"]),
  ).resolves.toMatchObject({
    permissions: PLATFORM_PERMISSIONS,
    protectedRole: true,
    platform: true,
  });
  expect(access.isRegistered).toHaveBeenCalledExactlyOnceWith("operator:user-1", "operator");
  expect(access.qualified).toHaveBeenCalledExactlyOnceWith(
    "operator:user-1",
    "platform",
    "operator",
  );
  expect(access.grant).toHaveBeenCalledExactlyOnceWith("operator:user-1", "platform");
  expect(operator.permissions).toEqual([]);
  expect(operator.tenantId).toBe("");
});

it("権限ガードは会員種別と企業の境界を維持する / 運営は企業側の管理権限でplatform権限の欠落を補えない", async () => {
  const operator = await authenticateAccount({ service: "operator" });
  access.grant.mockImplementation(async (_userId, scope) =>
    scope === "org-1"
      ? { active: true, protectedRole: true, permissions: PLATFORM_PERMISSIONS }
      : null,
  );
  await expect(provider.authorize(operator, ["organization.manage"])).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(access.grant).toHaveBeenCalledExactlyOnceWith("operator:user-1", "platform");
});

it("権限ガードは会員種別と企業の境界を維持する / サービス未解決のIdentityでは空の権限要求も拒否する", async () => {
  await expect(provider.authorize(verifiedSubject, [])).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(access.grant).not.toHaveBeenCalled();
});

it("会員ライフサイクルの認証は用途を限定する / 同じ本人情報を使ってもライフサイクルの用途を別の会員解決へ引き継がない", async () => {
  const authenticated = await provider.authenticate(new Request("https://example.test/api/trpc"));
  const registration = await provider.resolveActor(
    authenticated,
    { service: "customer", purpose: "registration" },
    "foreign-org",
  );
  const business = await provider.resolveActor(authenticated, { service: "business" }, "org-1");
  await expect(provider.authorize(registration, [])).resolves.toMatchObject({
    identity: { channel: "customer", tenantId: "", permissions: [] },
    purpose: "registration",
  });
  const grant = await provider.authorize(business, ["order:read"]);
  expect(grant.identity).toMatchObject({ channel: "business", tenantId: "org-1" });
  expect(grant.purpose).toBeUndefined();
  expect(authenticate).toHaveBeenCalledTimes(1);
});

it.each([null, { id: "deleted-customer", deleted: true }])(
  "会員ライフサイクルの認証は用途を限定する / 未登録・退会済みの本人%sも登録状態確認では企業所属を要求しない",
  async (account) => {
    access.resolveAccount.mockResolvedValue(account);
    access.isRegistered.mockResolvedValue(false);
    access.qualified.mockResolvedValue(false);
    const registration = await authenticateActor(
      provider,
      new Request("https://example.test/api/trpc", {
        headers: { "x-organization-id": "foreign-org" },
      }),
      { service: "customer", purpose: "registration" },
    );
    await expect(provider.authorize(registration, [])).resolves.toMatchObject({
      identity: { userId: "", subjectId: "subject-1", channel: "customer", tenantId: "" },
      permissions: [],
      purpose: "registration",
    });
    expect(access.isRegistered).not.toHaveBeenCalled();
    expect(access.qualified).not.toHaveBeenCalled();
    expect(access.grant).not.toHaveBeenCalled();
  },
);

it.each(["registration", "invitation", "withdrawal"] as const)(
  "会員ライフサイクルの認証は用途を限定する / %sは企業ヘッダーと現在の業務権限を引き継がない",
  async (purpose) => {
    const identity = await authenticateAccount({ service: "customer", purpose }, "foreign-org");
    await expect(provider.authorize(identity, [])).resolves.toMatchObject({
      identity: { tenantId: "", permissions: [] },
      permissions: [],
      protectedRole: false,
      platform: false,
      purpose,
    });
    await expect(provider.authorize(identity, ["order:read"])).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(access.grant).not.toHaveBeenCalled();
  },
);

it("会員ライフサイクルの認証は用途を限定する / 会員照会の待機中にサービスと用途が変更されても解決開始時の選択を保持する", async () => {
  const selection: {
    service: "customer" | "operator";
    purpose: "registration" | "withdrawal";
  } = { service: "customer", purpose: "registration" };
  const authenticated = await provider.authenticate(new Request("https://example.test/api/trpc"));
  // 会員照会のawait中に呼び出し側の入力を変え、開始時のサービス・用途の固定を検証する。
  const pendingAccount =
    Promise.withResolvers<Awaited<ReturnType<AccessQuery["resolveAccount"]>>>();
  access.resolveAccount.mockImplementationOnce(async () => pendingAccount.promise);
  const pendingIdentity = provider.resolveActor(authenticated, selection, "foreign-org");
  selection.service = "operator";
  selection.purpose = "withdrawal";
  pendingAccount.resolve({ id: "customer:user-1", deleted: false });
  const identity = await pendingIdentity;
  expect(access.resolveAccount).toHaveBeenCalledExactlyOnceWith("subject-1", "customer");
  expect(identity).toMatchObject({
    channel: "customer",
    userId: "customer:user-1",
    tenantId: "",
    permissions: [],
  });
  await expect(provider.authorize(identity, [])).resolves.toMatchObject({
    purpose: "registration",
    platform: false,
  });
  expect(access.grant).not.toHaveBeenCalled();
});

it("会員ライフサイクルの認証は用途を限定する / 呼び出し元が認証後に変更した用途を引き継がない", async () => {
  const selection: { service: "customer"; purpose: "registration" | "invitation" } = {
    service: "customer",
    purpose: "registration",
  };
  const identity = await authenticateAccount(selection);
  selection.purpose = "invitation";
  await expect(provider.authorize(identity, [])).resolves.toMatchObject({
    purpose: "registration",
  });
});

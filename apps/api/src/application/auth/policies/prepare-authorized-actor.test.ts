import { beforeEach, expect, it, vi } from "vite-plus/test";
import type { AccessQuery } from "#api/application/access/queries/access-query.ts";
import { prepareAuthorizedActor } from "#api/application/auth/policies/prepare-authorized-actor.ts";
import type { Identity } from "#api/application/auth/contracts/identity.ts";
import type { IdentityProvider } from "#api/application/auth/providers/identity-provider.ts";
import type { ServiceActor } from "#api/application/auth/contracts/service-actor.ts";
import type { AccessRecords } from "#api/domain/access/repositories/access-repository.ts";
import {
  BUSINESS_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import { AccountIdentityProvider } from "#api/application/auth/providers/account-identity-provider.ts";
import { accessState } from "#api/application/access/shared/access-use-case-support.ts";

const authentication = { authenticate: vi.fn<IdentityProvider["authenticate"]>() };
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
const provider = new AccountIdentityProvider(authentication, access);
const verifiedSubject: Identity = {
  userId: "subject-1",
  subjectId: "subject-1",
  tenantId: "",
  role: "member",
  permissions: [],
};
const state: AccessRecords = {
  version: 1,
  organizations: [],
  customerAccounts: [],
  businessAccounts: [],
  operatorAccounts: [],
  roles: [],
  memberships: [],
  invitations: [],
};

async function authenticateAccount(selection: ServiceActor = { service: "business" }) {
  const actor = await provider.authenticate(new Request("https://example.test/api/trpc"));
  return provider.resolveActor(actor, selection, "org-1");
}

beforeEach(() => {
  vi.resetAllMocks();
  authentication.authenticate.mockResolvedValue(verifiedSubject);
  access.resolveAccount.mockImplementation(async (_subjectId, service) => ({
    id: `${service}:user-1`,
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

it("通信境界で現在権限からActorを作る / 生のIdentityに自己申告の権限があっても認可しない", async () => {
  await expect(
    prepareAuthorizedActor(
      provider,
      {
        ...verifiedSubject,
        channel: "business",
        tenantId: "org-1",
        role: "admin",
        permissions: BUSINESS_PERMISSIONS,
      },
      ["product.update"],
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(access.grant).not.toHaveBeenCalled();
});

it("通信境界で現在権限からActorを作る / 会員Identityのコピーや別プロバイダーの発行値は認可しない", async () => {
  const identity = await authenticateAccount();
  vi.clearAllMocks();
  await expect(
    prepareAuthorizedActor(provider, { ...identity }, ["product.read"]),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const other = new AccountIdentityProvider(authentication, access);
  await expect(prepareAuthorizedActor(other, identity, ["product.read"])).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(access.grant).not.toHaveBeenCalled();
});

it("通信境界で現在権限からActorを作る / 認証時ではなく現在の権限と保護ロールを不変の普通の値として渡す", async () => {
  const identity = await authenticateAccount();
  access.grant.mockResolvedValue({
    active: true,
    protectedRole: false,
    permissions: ["product.read"],
  });
  const actor = await prepareAuthorizedActor(provider, identity, ["product.read"]);
  expect(actor).toMatchObject({
    userId: "business:user-1",
    service: "business",
    tenantId: "org-1",
    role: "member",
    permissions: ["product.read"],
    rolePermissions: ["product.read"],
    protectedRole: false,
    platform: false,
  });
  expect(Object.isFrozen(actor)).toBe(true);
  expect(Object.isFrozen(actor.permissions)).toBe(true);
  expect(Object.isFrozen(actor.rolePermissions)).toBe(true);
  expect(Reflect.set(actor, "role", "admin")).toBe(false);
  expect(Reflect.set(actor.permissions, "0", "product.update")).toBe(false);
  expect({ ...actor }).toEqual(actor);
  expect(identity.permissions).toEqual(BUSINESS_PERMISSIONS);
});

it("通信境界で現在権限からActorを作る / 会員Identityを再利用する次の操作でも権限失効を再確認する", async () => {
  const identity = await authenticateAccount();
  await prepareAuthorizedActor(provider, identity, ["product.update"]);
  access.grant.mockResolvedValue({
    active: true,
    protectedRole: false,
    permissions: ["product.read"],
  });
  await expect(
    prepareAuthorizedActor(provider, identity, ["product.update"]),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("通信境界で現在権限からActorを作る / プラン上限前のロール権限は委任判断に残すが操作の許可に使わない", async () => {
  const identity = await authenticateAccount();
  access.grant.mockResolvedValue({
    active: true,
    protectedRole: true,
    permissions: ["member.assign_role"],
    rolePermissions: BUSINESS_PERMISSIONS,
  });
  const actor = await prepareAuthorizedActor(provider, identity, ["member.assign_role"]);
  expect(actor.rolePermissions).toContain("product.update");
  expect(actor.permissions).not.toContain("product.update");
  await expect(
    prepareAuthorizedActor(provider, identity, ["product.update"]),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("通信境界で現在権限からActorを作る / 顧客のDB grantに混入した企業用権限で操作できない", async () => {
  const identity = await authenticateAccount({ service: "customer" });
  const actor = await prepareAuthorizedActor(provider, identity, ["product.read"]);
  expect(actor.permissions).not.toContain("product.update");
  await expect(
    prepareAuthorizedActor(provider, identity, ["product.update"]),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("通信境界で現在権限からActorを作る / 要求した権限は一つでも不足すれば拒否する", async () => {
  const identity = await authenticateAccount();
  access.grant.mockResolvedValue({
    active: true,
    protectedRole: false,
    permissions: ["order:read"],
  });
  await expect(
    prepareAuthorizedActor(provider, identity, ["order:read", "order:create"]),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("通信境界で現在権限からActorを作る / 出力Actorを本人確認の代わりに次の操作の認可へ戻せない", async () => {
  const identity = await authenticateAccount();
  const actor = await prepareAuthorizedActor(provider, identity, ["product.read"]);
  await expect(prepareAuthorizedActor(provider, actor, ["product.read"])).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});

it.each(["registration", "invitation", "withdrawal"] as const)(
  "ライフサイクルは本人と対象サービスに結び付ける / %sの用途はActorの値として維持する",
  async (purpose) => {
    const identity = await authenticateAccount({ service: "customer", purpose });
    const actor = await prepareAuthorizedActor(provider, identity, []);
    expect(actor).toMatchObject({
      purpose,
      service: "customer",
      subjectId: "subject-1",
      tenantId: "",
      permissions: [],
    });
  },
);

it("ライフサイクルは本人と対象サービスに結び付ける / ライフサイクルのIdentityを通常権限やAccess状態へ昇格できない", async () => {
  const identity = await authenticateAccount({ service: "business", purpose: "registration" });
  await expect(prepareAuthorizedActor(provider, identity, ["product.read"])).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(
    prepareAuthorizedActor(provider, identity, [], { scope: "org-1", state }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("Accessの判断状態と保存版を認可前の値に固定する / 同じscopeの状態は証明消費なしで業務処理へ渡せる", async () => {
  const identity = await authenticateAccount();
  const actor = await prepareAuthorizedActor(provider, identity, ["member.read"], {
    scope: "org-1",
    state,
  });
  expect(accessState(actor, "org-1")).toEqual(state);
  expect(accessState(actor, "org-1")).toBe(actor.accessSnapshot?.state);
  expect(Object.isFrozen(actor.accessSnapshot)).toBe(true);
  expect(Object.isFrozen(actor.accessSnapshot?.state)).toBe(true);
});

it.each(["org-2", "platform"])(
  "Accessの判断状態と保存版を認可前の値に固定する / 企業会員に%sのAccess状態を渡さない",
  async (scope) => {
    const identity = await authenticateAccount();
    await expect(
      prepareAuthorizedActor(provider, identity, ["member.read"], { scope, state }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  },
);

it("Accessの判断状態と保存版を認可前の値に固定する / 異なるscopeへの流用と状態のない呼出しは業務のデータ境界で拒否する", async () => {
  const identity = await authenticateAccount();
  const actor = await prepareAuthorizedActor(provider, identity, ["member.read"], {
    scope: "org-1",
    state,
  });
  expect(() => accessState(actor, "org-2")).toThrow();
  const unscoped = await prepareAuthorizedActor(provider, identity, ["member.read"]);
  expect(() => accessState(unscoped, "org-1")).toThrow();
});

it("Accessの判断状態と保存版を認可前の値に固定する / 認可の待機中に呼出元が要求や状態を書き換えても取り込まない", async () => {
  const identity = await authenticateAccount();
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const current = provider.authorize.bind(provider);
  const authorize = vi
    .spyOn(provider, "authorize")
    .mockImplementationOnce(async (actor, required) => {
      await wait;
      return current(actor, required);
    });
  const required: PermissionCode[] = ["member.read"];
  const mutableState = { ...state, version: 7, roles: [...state.roles] };
  const snapshot = { scope: "org-1", state: mutableState };
  const pending = prepareAuthorizedActor(provider, identity, required, snapshot);
  required.push("member.remove");
  snapshot.scope = "org-2";
  mutableState.version = 8;
  release();
  const actor = await pending;
  expect(actor.accessSnapshot).toMatchObject({ scope: "org-1", state: { version: 7 } });
  expect(authorize).toHaveBeenLastCalledWith(identity, ["member.read"]);
});

it("Accessの判断状態と保存版を認可前の値に固定する / 運営のplatform状態と実効権限を普通のActorとして保持する", async () => {
  access.grant.mockResolvedValue({
    active: true,
    protectedRole: true,
    permissions: PLATFORM_PERMISSIONS,
  });
  const identity = await authenticateAccount({ service: "operator" });
  const actor = await prepareAuthorizedActor(provider, identity, ["user.read"], {
    scope: "platform",
    state,
  });
  expect(actor).toMatchObject({ service: "operator", platform: true });
  expect(accessState(actor, "platform")).toEqual(state);
});

it("個人Accessの状態 / プラン権限がなくても本人IDのスナップショットを受け取れる", async () => {
  const identity = await authenticateAccount({ service: "customer" });
  const actor = await prepareAuthorizedActor(provider, identity, [], {
    scope: identity.userId,
    state,
  });
  expect(accessState(actor, identity.userId)).toEqual(state);
  expect(actor.platform).toBe(false);
});
it.each(["customer:other", "org-1", "platform"])(
  "個人Accessの状態 / 本人が%sのスナップショットを使えない",
  async (scope) => {
    const identity = await authenticateAccount({ service: "customer" });
    await expect(
      prepareAuthorizedActor(provider, identity, [], { scope, state }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  },
);

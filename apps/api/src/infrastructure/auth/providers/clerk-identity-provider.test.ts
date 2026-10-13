import { beforeEach, it, expect, vi } from "vite-plus/test";
import { ClerkIdentityProvider } from "#api/infrastructure/auth/providers/clerk-identity-provider.ts";

// 外部Clerk通信だけを差し替え、JWT結果から会員権限を作らないアダプターの境界を検証する。
const mocks = vi.hoisted(() => ({ verify: vi.fn(), getUser: vi.fn(), getSession: vi.fn() }));
vi.mock("@clerk/backend", () => ({
  verifyToken: mocks.verify,
  createClerkClient: () => ({
    users: { getUser: mocks.getUser },
    sessions: { getSession: mocks.getSession },
  }),
}));
const provider = new ClerkIdentityProvider("test-secret", ["https://business.example.com"]);
const request = (path = "access.session") =>
  new Request(`https://business.example.com${path.startsWith("/") ? path : `/api/trpc/${path}`}`, {
    headers: { authorization: "Bearer token" },
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.verify.mockResolvedValue({
    sub: "user-1",
    sid: "session-1",
    sts: "active",
    org_id: "untrusted-org",
    org_role: "org:admin",
  });
  mocks.getSession.mockResolvedValue({ status: "active", userId: "user-1" });
  mocks.getUser.mockResolvedValue({
    primaryEmailAddressId: "email-1",
    emailAddresses: [
      { id: "email-1", emailAddress: "verified@example.com", verification: { status: "verified" } },
    ],
  });
});
it("Clerk SDKの認証境界 / SDKが直接返すJWT payloadを受け取り、org_roleから権限を作らない", async () => {
  expect(await provider.authenticate(request())).toMatchObject({
    userId: "user-1",
    subjectId: "user-1",
    tenantId: "",
    permissions: [],
    role: "member",
  });
  expect(mocks.verify).toHaveBeenCalledWith("token", {
    secretKey: "test-secret",
    authorizedParties: ["https://business.example.com"],
  });
  expect(mocks.getUser).toHaveBeenCalledExactlyOnceWith("user-1");
});

it.each(["access.acceptInvitation", "/api/trpc/access.registerCustomer"])(
  "Clerk SDKの認証境界 / %sでは本人の確認済みprimary emailを取得する",
  async (path) => {
    expect((await provider.authenticate(request(path))).email).toBe("verified@example.com");
    expect(mocks.getUser).toHaveBeenCalledWith("user-1");
  },
);

it.each(["access.acceptInvitation", "/api/trpc/access.registerCustomer"])(
  "Clerk SDKの認証境界 / %sで未確認メールを本人のメールと認めない",
  async (path) => {
    mocks.getUser.mockResolvedValue({
      primaryEmailAddressId: "email-1",
      emailAddresses: [
        {
          id: "email-1",
          emailAddress: "verified@example.com",
          verification: { status: "unverified" },
        },
      ],
    });
    expect((await provider.authenticate(request(path))).email).toBeUndefined();
  },
);

it.each([
  "access.session",
  "access.registration",
  "access.registerCustomer",
  "access.acceptInvitation,access.session",
  "/api/trpc/access.registerCustomer,order.create",
])(
  "Clerk SDKの認証境界 / %sでもURLに依存せず確認済みメールを内部の本人情報に含める",
  async (path) => {
    expect((await provider.authenticate(request(path))).email).toBe("verified@example.com");
    expect(mocks.getUser).toHaveBeenCalledExactlyOnceWith("user-1");
  },
);

it("Clerk SDKの認証境界 / 確認済みsecondary emailを未確認primary emailの代わりに使わない", async () => {
  mocks.getUser.mockResolvedValue({
    primaryEmailAddressId: "primary",
    emailAddresses: [
      {
        id: "primary",
        emailAddress: "primary@example.com",
        verification: { status: "unverified" },
      },
      {
        id: "secondary",
        emailAddress: "secondary@example.com",
        verification: { status: "verified" },
      },
    ],
  });
  expect(
    (await provider.authenticate(request("/api/trpc/access.registerCustomer"))).email,
  ).toBeUndefined();
});

it.each(["deleted", "unavailable"])(
  "Clerk SDKの認証境界 / Clerk利用者が%sなら署名付きJWTがあっても失敗する",
  async () => {
    mocks.getUser.mockRejectedValue(new Error("private provider lifecycle details"));
    await expect(provider.authenticate(request())).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "認証情報を確認できません。ログインし直してください",
    });
  },
);

it.each(["banned", "locked"])(
  "Clerk SDKの認証境界 / Clerk利用者が%sなら全サービスを拒否する",
  async (flag) => {
    mocks.getUser.mockResolvedValue({ [flag]: true });
    for (const endpoint of ["/api/trpc", "/api/business/trpc", "/api/admin/trpc"]) {
      await expect(
        provider.authenticate(request(`${endpoint}/access.registration`)),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
  },
);

it("Clerk SDKの認証境界 / 無効なトークンを401と日本語で返す", async () => {
  mocks.verify.mockRejectedValue(new Error("private verification details"));
  await expect(provider.authenticate(request())).rejects.toMatchObject({
    code: "UNAUTHORIZED",
    message: "認証が必要です。ログインし直してください",
  });
});

it("Clerk SDKの認証境界 / subがないpayloadは認証として受け入れない", async () => {
  mocks.verify.mockResolvedValue({ data: { sub: "wrong-wrapper" } });
  await expect(provider.authenticate(request())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});

it.each(["pending", "revoked", "unknown"])(
  "セッション完了・失効の認証境界 / JWTの%s状態を利用者照会前に拒否する",
  async (sts) => {
    mocks.verify.mockResolvedValue({ sub: "user-1", sid: "session-1", sts });
    await expect(provider.authenticate(request())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
  },
);

it("セッション完了・失効の認証境界 / セッションIDのないJWTテンプレートを拒否する", async () => {
  mocks.verify.mockResolvedValue({ sub: "user-1" });
  await expect(provider.authenticate(request())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});

it.each(["pending", "revoked", "ended", "expired"])(
  "セッション完了・失効の認証境界 / 署名が有効でも現在のセッションが%sなら拒否する",
  async (status) => {
    mocks.getSession.mockResolvedValue({ status, userId: "user-1" });
    await expect(provider.authenticate(request())).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
  },
);

it("セッション完了・失効の認証境界 / セッション本人がJWTと一致しない場合を拒否する", async () => {
  mocks.getSession.mockResolvedValue({ status: "active", userId: "another-user" });
  await expect(provider.authenticate(request())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});

it("セッション完了・失効の認証境界 / 状態claimを持たない旧JWTも現在のセッションを照会する", async () => {
  mocks.verify.mockResolvedValue({ sub: "user-1", sid: "session-1" });
  await expect(provider.authenticate(request())).resolves.toMatchObject({ userId: "user-1" });
  expect(mocks.getSession).toHaveBeenCalledWith("session-1");
});

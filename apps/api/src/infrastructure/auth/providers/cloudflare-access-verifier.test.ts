// @vitest-environment node
import { beforeAll, describe, it, expect, vi } from "vite-plus/test";
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from "jose";
import { verifyAdminAccess } from "#api/infrastructure/auth/providers/cloudflare-access-verifier.ts";

const mocks = vi.hoisted(() => ({ keys: vi.fn() }));
vi.mock("jose", async (importOriginal) => {
  const original = await importOriginal<typeof import("jose")>();
  return { ...original, createRemoteJWKSet: () => mocks.keys };
});
const ISSUER = "https://team.cloudflareaccess.com";
const AUDIENCE = "admin-audience";
const TOKEN_VALIDITY_SECONDS = 60;
let pair: Awaited<ReturnType<typeof generateKeyPair>>;
// 鍵のネットワーク取得だけを置き換え、署名・期限・issuer・audienceは実際のJWT検証へ通す。
beforeAll(async () => {
  pair = await generateKeyPair("RS256");
  const jwk = await exportJWK(pair.publicKey);
  const keys = createLocalJWKSet({ keys: [{ ...jwk, kid: "test-key" }] });
  mocks.keys.mockImplementation(keys);
});

async function token(
  options: {
    audience?: string;
    issuer?: string;
    expired?: boolean;
    invalidSignature?: boolean;
  } = {},
) {
  const signing = options.invalidSignature
    ? (await generateKeyPair("RS256")).privateKey
    : pair.privateKey;
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setSubject("access-user")
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + (options.expired ? -TOKEN_VALIDITY_SECONDS : TOKEN_VALIDITY_SECONDS))
    .sign(signing);
}

async function verify(value: string) {
  return verifyAdminAccess(
    new Request("https://admin.example.com/api/admin/trpc", {
      headers: { "cf-access-jwt-assertion": value },
    }),
    { APP_ENV: "production", ADMIN_ACCESS_ISSUER: ISSUER, ADMIN_ACCESS_AUDIENCE: AUDIENCE },
  );
}

describe("運営APIのAccess境界", () => {
  it("署名・発行者・audience・期限が正しいJWTだけを受け入れる", async () => {
    await expect(verify(await token())).resolves.toBeUndefined();
  });
  it.each([
    { audience: "other-app" },
    { issuer: "https://other.cloudflareaccess.com" },
    { expired: true },
    { invalidSignature: true },
  ])("不正なJWTを拒否する：%j", async (options) => {
    await expect(verify(await token(options))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("本番は設定・JWTがなければ拒否する", async () => {
    await expect(
      verifyAdminAccess(new Request("https://admin.example.com/api/admin/trpc"), {
        APP_ENV: "production",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("ローカル以外のホストではデモ設定でも迂回できない", async () => {
    await expect(
      verifyAdminAccess(new Request("https://admin.example.com/api/admin/trpc"), {
        APP_ENV: "local",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("ローカルループバックでのみAccessを省略する", async () => {
    await expect(
      verifyAdminAccess(new Request("http://127.0.0.1/api/admin/trpc"), { APP_ENV: "local" }),
    ).resolves.toBeUndefined();
  });
});

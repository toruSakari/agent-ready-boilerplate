// @vitest-environment node
import { afterEach, beforeEach, expect, vi } from "vite-plus/test";
import type { FrontendSessionOptions } from "@dev-template/config/auth";

// SDKの応答分岐はここで制御する。署名そのものの検証はRSA/JWKSの統合テストに分ける。
const { authenticateRequest, createClerkClient, cloudflareEnvironment } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  createClerkClient: vi.fn(),
  cloudflareEnvironment: {
    APP_ENV: "production",
    CLERK_SECRET_KEY: "sk_live_frontend_auth_fixture",
    CLERK_AUTHORIZED_PARTIES: "https://web.example.com",
  },
}));
vi.mock("@clerk/backend", () => ({ createClerkClient }));
vi.mock("cloudflare:workers", () => ({ env: cloudflareEnvironment }));

export const ORIGIN = "https://web.example.com";
export const ISSUER = "https://clerk.example.com";
export const PUBLISHABLE_KEY = `pk_live_${Buffer.from("clerk.example.com$").toString("base64")}`;
export const SECRET_KEY = "sk_live_frontend_auth_fixture";
export const COOKIES = [
  "__session=refreshed; Path=/; HttpOnly; Secure; SameSite=Lax",
  "__client_uat=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; Secure",
];

export function options(overrides: Partial<FrontendSessionOptions> = {}): FrontendSessionOptions {
  return {
    development: false,
    publishableKey: PUBLISHABLE_KEY,
    environment: {
      APP_ENV: "production",
      CLERK_SECRET_KEY: SECRET_KEY,
      CLERK_AUTHORIZED_PARTIES: ORIGIN,
    },
    ...overrides,
  };
}

export function documentRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("accept", "text/html,application/xhtml+xml");
  return new Request(new URL(path, ORIGIN), { ...init, headers });
}

export function decisionHeaders(location?: string) {
  const headers = new Headers({ "Cache-Control": "public, max-age=3600" });
  for (const cookie of COOKIES) {
    headers.append("Set-Cookie", cookie);
  }

  if (location) {
    headers.set("Location", location);
  }

  return headers;
}

export function signedIn(headers = new Headers()) {
  return {
    status: "signed-in",
    isAuthenticated: true,
    headers,
    toAuth: vi.fn(() => ({
      userId: "user_fixture",
      sessionId: "sess_fixture",
      sessionClaims: { iss: ISSUER, azp: ORIGIN },
    })),
  };
}

export function signedOut(headers = new Headers()) {
  return { status: "signed-out", isAuthenticated: false, headers, toAuth: vi.fn(() => null) };
}

export function expectPrivate(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
}

export function expectContinue(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("x-frontend-continue")).toBe("1");
}

export function expectBlocked(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("x-frontend-continue")).toBeNull();
  expectPrivate(response);
}

beforeEach(() => {
  vi.resetAllMocks();
  cloudflareEnvironment.APP_ENV = "production";
  cloudflareEnvironment.CLERK_SECRET_KEY = SECRET_KEY;
  createClerkClient.mockReturnValue({ authenticateRequest });
  authenticateRequest.mockResolvedValue(signedOut());
});

afterEach(() => vi.unstubAllEnvs());

export { authenticateRequest, createClerkClient, cloudflareEnvironment };

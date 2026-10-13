import { expect } from "@playwright/test";
import type { APIRequestContext, Page, TestInfo } from "@playwright/test";
import { z } from "zod";
import { E2E_SERVER_ORIGINS } from "@/e2e/server-policy";

export const API_ORIGIN = E2E_SERVER_ORIGINS.api;
export const SCREENSHOT_VIEWPORT = { width: 1280, height: 900 };

export async function captureLifecycle(page: Page, testInfo: TestInfo, state: string) {
  await page.screenshot({
    path: testInfo.outputPath(`lifecycle-${state}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

export type ServiceCategory = "customer" | "business" | "operator";

export const serviceQuery = (service: ServiceCategory) => ({
  params: { input: JSON.stringify({ service }) },
});
export const registrationSchema = z.object({
  result: z.object({
    data: z.object({
      registered: z.boolean(),
      category: z.enum(["customer", "business", "operator"]),
      accountId: z.string().nullable(),
    }),
  }),
});
export const idSchema = z.object({
  result: z.object({ data: z.object({ id: z.string() }) }),
});
export const sessionSchema = z.object({
  result: z.object({
    data: z.object({
      userId: z.string(),
      organizations: z.array(z.object({ id: z.string() })),
    }),
  }),
});

export async function registration(request: APIRequestContext, category: ServiceCategory) {
  const response = await request.get(
    `${API_ORIGIN}/api/trpc/access.registration`,
    serviceQuery(category),
  );
  expect(response.status()).toBe(200);
  return registrationSchema.parse(await response.json()).result.data;
}

export async function enrollByInvitation(
  admin: APIRequestContext,
  invitee: APIRequestContext,
  email: string,
  category: ServiceCategory,
  scope: string,
  roleId: string,
) {
  const invite = await admin.post(`${API_ORIGIN}/api/trpc/access.invite`, {
    data: { service: "operator", scope, email, roleId, actorKind: category },
  });
  expect(invite.status()).toBe(200);
  const token = z
    .object({ result: z.object({ data: z.object({ token: z.string() }) }) })
    .parse(await invite.json()).result.data.token;
  const accept = await invitee.post(`${API_ORIGIN}/api/trpc/access.acceptInvitation`, {
    data: { service: category, token, name: "サービス登録テスト" },
  });
  expect(accept.status()).toBe(200);
}

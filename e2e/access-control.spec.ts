import { createCustomerOrder } from "@/e2e/customer-order-fixture";
import type { APIRequestContext, Page, Browser } from "@playwright/test";
import { test, expect } from "@/e2e/fixtures";
import { z } from "zod";

const ADMIN_ORIGIN = "http://127.0.0.1:5175";
const BUSINESS_ORIGIN = "http://127.0.0.1:5174";
const INVITATION_ROLE_FLOW_TIMEOUT_MS = 60_000;
test("所属する企業を選択し、別タブで別企業を操作できる", async (props) => {
  await props.page.goto("/");
  await expect(props.page.getByRole("heading", { name: "利用する企業を選択" })).toBeVisible();
  await expect(props.page.getByRole("heading", { name: "デモ企業A", exact: true })).toBeVisible();
  await expect(props.page.getByRole("heading", { name: "デモ企業B", exact: true })).toBeVisible();
  await props.page.getByRole("link", { name: "この企業に入る" }).first().click();
  await expect(props.page).toHaveURL(/organizations\/demo-store$/);
  const another = await props.context.newPage();
  await another.goto(`${BUSINESS_ORIGIN}/organizations/demo-second/members`);
  await expect(another.getByRole("heading", { name: "メンバー・権限", exact: true })).toBeVisible();
  await expect(props.page).toHaveURL(/organizations\/demo-store$/);
  await another.close();
});
test("運営が企業を発行し、初期オーナーの招待・承諾・カスタムロール作成・招待許可の制御を行える", async (props) => {
  const initialState = { page: props.page, browser: props.browser };
  const flow0 = await createInvitedOrganization(initialState);
  const flow1 = await acceptOwnerAndCreateRole(flow0);
  await verifyOrganizationInvitationPolicy(flow1);
});
test("公開API経由の運営操作と企業IDの偽装を拒否する", async (props) => {
  const platform = await props.request.get("/api/trpc/access.users", {
    headers: { "x-demo-user": "demo-member" },
  });
  expect(platform.status()).toBe(403);
  const scope = await props.request.get("/api/trpc/access.members", {
    params: {
      input: JSON.stringify({ service: "business", scope: "demo-second" }),
    },
  });
  expect(scope.status()).toBe(403);
  const forged = await props.request.get("/api/trpc/order.list", {
    params: { input: JSON.stringify({ service: "business" }) },
    headers: {
      "x-demo-user": "demo-member",
      "x-organization-id": "demo-second",
    },
  });
  expect(forged.status()).toBe(403);
});
test("顧客用APIでは他ユーザーの注文と企業権限管理を公開しない", async (props) => {
  const order = await createCustomerOrder(
    props.request,
    [
      {
        sku: `private-${crypto.randomUUID()}`,
        name: "別の一般ユーザーの注文",
        quantity: 1,
        unitPrice: 100,
      },
    ],
    { draft: true, user: "demo-user" },
  );
  const list = await props.request.get("http://127.0.0.1:5173/api/trpc/order.list", {
    headers: { "x-demo-user": "demo-customer" },
    params: { input: JSON.stringify({ service: "customer" }) },
  });
  expect(list.status()).toBe(200);
  expect(JSON.stringify(await list.json())).not.toContain(order.id);
  const forbidden = await props.request.get("http://127.0.0.1:5173/api/trpc/access.members", {
    headers: { "x-demo-user": "demo-customer" },
    params: {
      input: JSON.stringify({ service: "business", scope: "demo-store" }),
    },
  });
  expect(forbidden.status()).toBe(403);
});

test("HTTP: キャッシュした権限が残っていても現在の権限をAPIで検証する", async (props) => {
  const initialState = { request: props.request };
  const flow0 = await createPermissionFixture(initialState);
  const flow1 = await invitePermissionFixture(flow0);
  const flow2 = await verifyInitialPermission(flow1);
  const flow3 = await createReadOnlyProductRole(flow2);
  const flow4 = await revokeOrderPermission(flow3);
  await verifyRefreshedPermission(flow4);
});

async function createInvitedOrganization(state: { page: Page; browser: Browser }) {
  const { page } = state;
  test.setTimeout(INVITATION_ROLE_FLOW_TIMEOUT_MS);
  await page.goto(`${ADMIN_ORIGIN}/organizations/new`);
  const company = `企業テスト-${crypto.randomUUID()}`;
  await page.getByLabel("企業名", { exact: true }).fill(company);
  await page.getByRole("button", { name: "企業を作成", exact: true }).click();
  await expect(page.getByRole("heading", { name: company, exact: true }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/organizations\/[^/]+$/);
  const organizationId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.goto(`${ADMIN_ORIGIN}/organizations/${organizationId}/members`);
  const email = `e2e-${crypto.randomUUID()}@example.com`;
  await page.getByLabel("メールアドレス", { exact: true }).fill(email);
  await page.getByLabel("招待するロール").selectOption({ label: "オーナー" });
  await page.getByRole("button", { name: "招待を発行" }).click();
  const invite = await page.getByLabel("招待リンク（本人に共有してください）").inputValue();
  const plan = await page.request.post(`${ADMIN_ORIGIN}/api/trpc/access.assignPlan`, {
    data: {
      category: "business",
      id: organizationId,
      planCode: "business:demo",
    },
  });
  expect(plan.status()).toBe(200);
  return { ...state, company, organizationId, email, invite, plan };
}

async function acceptOwnerAndCreateRole(
  state: Awaited<ReturnType<typeof createInvitedOrganization>>,
) {
  const { browser, organizationId, email, invite } = state;
  const userId = `user-${crypto.randomUUID()}`;
  const user = await browser.newContext({
    extraHTTPHeaders: { "x-demo-user": userId, "x-demo-email": email },
  });
  const userPage = await user.newPage();
  await userPage.goto(invite);
  await expect(userPage).toHaveURL(`${BUSINESS_ORIGIN}/invitations/accept`);
  await userPage.reload();
  await userPage.getByLabel("表示名", { exact: true }).fill("企業オーナー");
  await userPage.getByRole("button", { name: "招待を承諾" }).click();
  await expect(userPage.getByText("招待を承諾しました。", { exact: true })).toBeVisible();
  await userPage.getByRole("link", { name: "利用を開始" }).click();
  await expect(userPage).toHaveURL(new RegExp(organizationId));
  await userPage.goto(`${BUSINESS_ORIGIN}/organizations/${organizationId}/members`);
  await expect(userPage.getByRole("heading", { name: "企業オーナー", exact: true })).toBeVisible();
  await userPage.goto(`${BUSINESS_ORIGIN}/organizations/${organizationId}/roles`);
  await userPage.getByLabel("ロール名", { exact: true }).first().fill("注文閲覧担当");
  await userPage.getByLabel("注文閲覧", { exact: true }).first().check();
  await userPage.getByRole("button", { name: "ロールを保存" }).first().click();
  await expect(userPage.getByText("注文閲覧担当を編集", { exact: true })).toBeVisible();
  await userPage.goto(`${BUSINESS_ORIGIN}/organizations/${organizationId}/members`);
  await userPage.getByLabel("メールアドレス", { exact: true }).fill("blocked@example.com");
  return { ...state, userId, user, userPage };
}

async function verifyOrganizationInvitationPolicy(
  state: Awaited<ReturnType<typeof acceptOwnerAndCreateRole>>,
) {
  const { page, organizationId, user, userPage } = state;
  await userPage.getByLabel("招待するロール").selectOption({ label: "スタッフ" });
  await userPage.getByRole("button", { name: "招待を発行" }).click();
  await expect(userPage.getByRole("alert")).toContainText("この操作を行う権限がありません");
  await page.goto(`${ADMIN_ORIGIN}/organizations/${organizationId}`);
  await page.getByRole("button", { name: "企業からの招待を許可する" }).click();
  await expect(page.getByRole("button", { name: "企業からの招待を無効にする" })).toBeVisible();
  await userPage.getByRole("button", { name: "招待を発行" }).click();
  await expect(userPage.getByLabel("招待リンク（本人に共有してください）")).toBeVisible();
  await user.close();
  return { ...state };
}

async function createPermissionFixture(state: { request: APIRequestContext }) {
  const { request } = state;
  const nonce = crypto.randomUUID();
  const created = await request.post("/api/trpc/access.createOrganization", {
    data: { name: `権限再検証-${nonce}` },
  });
  expect(created.status()).toBe(200);
  const idResponse = z.object({
    result: z.object({ data: z.object({ id: z.string() }) }),
  });
  const organizationId = idResponse.parse(await created.json()).result.data.id;
  const plan = await request.post("/api/trpc/access.assignPlan", {
    data: {
      category: "business",
      id: organizationId,
      planCode: "business:demo",
    },
  });
  expect(plan.status()).toBe(200);
  const email = `permission-${nonce}@example.com`;
  return { ...state, nonce, created, idResponse, organizationId, plan, email };
}

async function invitePermissionFixture(state: Awaited<ReturnType<typeof createPermissionFixture>>) {
  const { request, nonce, organizationId, email } = state;
  const invitation = await request.post("/api/trpc/access.invite", {
    data: {
      service: "operator",
      scope: organizationId,
      email,
      roleId: `${organizationId}:staff`,
      actorKind: "business",
    },
  });
  expect(invitation.status()).toBe(200);
  const token = z
    .object({ result: z.object({ data: z.object({ token: z.string() }) }) })
    .parse(await invitation.json()).result.data.token;
  const headers = {
    "x-demo-user": `permission-${nonce}`,
    "x-demo-email": email,
    "x-organization-id": organizationId,
  };
  const accepted = await request.post("/api/trpc/access.acceptInvitation", {
    headers,
    data: { service: "business", token, name: "権限再検証担当" },
  });
  return { ...state, invitation, token, headers, accepted };
}

async function verifyInitialPermission(state: Awaited<ReturnType<typeof invitePermissionFixture>>) {
  const { request, organizationId, headers, accepted } = state;
  expect(accepted.status()).toBe(200);
  const input = { input: JSON.stringify({ service: "business" }) };
  const sessionResponse = await request.get("/api/trpc/access.session", {
    headers,
    params: input,
  });
  expect(sessionResponse.status()).toBe(200);
  const sessionSchema = z.object({
    result: z.object({ data: z.object({ permissions: z.array(z.string()) }) }),
  });
  const cachedSession = sessionSchema.parse(await sessionResponse.json()).result.data;
  expect(cachedSession.permissions).toContain("order:read");
  expect((await request.get("/api/trpc/order.list", { headers, params: input })).status()).toBe(
    200,
  );
  const members = await request.get("/api/trpc/access.members", {
    params: {
      input: JSON.stringify({ service: "operator", scope: organizationId }),
    },
  });
  expect(members.status()).toBe(200);
  return { ...state, input, sessionResponse, sessionSchema, cachedSession, members };
}

async function createReadOnlyProductRole(
  state: Awaited<ReturnType<typeof verifyInitialPermission>>,
) {
  const { request, idResponse, organizationId, members } = state;
  const memberships = z
    .object({
      result: z.object({ data: z.array(z.object({ id: z.string() })) }),
    })
    .parse(await members.json()).result.data;
  expect(memberships).toHaveLength(1);
  const membership = memberships[0];
  if (!membership) {
    throw new Error("テスト会員の所属が見つかりません");
  }

  const role = await request.post("/api/trpc/access.saveRole", {
    data: {
      service: "operator",
      scope: organizationId,
      name: "商品閲覧のみ",
      permissions: ["product.read"],
    },
  });
  expect(role.status()).toBe(200);
  const roleId = idResponse.parse(await role.json()).result.data.id;
  return { ...state, memberships, membership, role, roleId };
}

async function revokeOrderPermission(state: Awaited<ReturnType<typeof createReadOnlyProductRole>>) {
  const { request, organizationId, headers, input, cachedSession, membership, roleId } = state;
  const changed = await request.post("/api/trpc/access.assignRole", {
    data: {
      service: "operator",
      scope: organizationId,
      membershipId: membership.id,
      roleId,
    },
  });
  expect(changed.status()).toBe(200);
  expect(cachedSession.permissions).toContain("order:read");
  expect((await request.get("/api/trpc/order.list", { headers, params: input })).status()).toBe(
    403,
  );
  expect((await request.get("/api/trpc/product.list", { headers, params: input })).status()).toBe(
    200,
  );
  const refreshed = await request.get("/api/trpc/access.session", {
    headers,
    params: input,
  });
  expect(refreshed.status()).toBe(200);
  return { ...state, changed, refreshed };
}

async function verifyRefreshedPermission(state: Awaited<ReturnType<typeof revokeOrderPermission>>) {
  const { sessionSchema, refreshed } = state;
  expect(sessionSchema.parse(await refreshed.json()).result.data.permissions).toEqual([
    "product.read",
  ]);
  return { ...state };
}

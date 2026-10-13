import { test, expect } from "@/e2e/fixtures";
import { E2E_SERVER_ORIGINS } from "@/e2e/server-policy";
import { z } from "zod";

const memberResponse = z.object({
  result: z.object({
    data: z.array(
      z.object({
        id: z.string(),
        userId: z.string(),
        category: z.string(),
        name: z.string(),
        email: z.string().nullable(),
      }),
    ),
  }),
});

test("企業メンバーのAPI応答に一般ユーザーの氏名・メール・会員IDを含めない", async (props) => {
  for (const origin of [
    E2E_SERVER_ORIGINS.api,
    E2E_SERVER_ORIGINS.business,
    E2E_SERVER_ORIGINS.admin,
  ]) {
    const response = await props.request.get(`${origin}/api/trpc/access.members`, {
      params: { input: JSON.stringify({ service: "business", scope: "demo-store" }) },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    const members = memberResponse.parse(body).result.data;
    expect(members.length).toBeGreaterThan(0);
    expect(members.every((member) => member.category === "business")).toBe(true);
    for (const privateValue of [
      "デモ一般ユーザー",
      "customer@example.com",
      "customer:demo-user",
      "customer:demo-customer",
    ]) {
      expect(JSON.stringify(body)).not.toContain(privateValue);
    }
  }
});

test("一般ユーザーは企業所属を持たず、企業・運営から一般ユーザーの招待を作れない", async (props) => {
  const session = await props.request.get(`${E2E_SERVER_ORIGINS.web}/api/trpc/access.session`, {
    headers: { "x-demo-user": "demo-customer" },
    params: { input: JSON.stringify({ service: "customer" }) },
  });
  expect(session.status()).toBe(200);
  expect(
    z
      .object({ result: z.object({ data: z.object({ organizations: z.array(z.unknown()) }) }) })
      .parse(await session.json()).result.data.organizations,
  ).toEqual([]);
  for (const service of ["business", "operator"]) {
    const invite = await props.request.post(`${E2E_SERVER_ORIGINS.api}/api/trpc/access.invite`, {
      data: {
        service,
        scope: "demo-store",
        email: "customer@example.com",
        actorKind: "customer",
        roleId: "demo-store:staff",
      },
    });
    expect(invite.status()).toBe(403);
  }
});

test("一般ユーザーの旧所属IDを指定してもロール変更・所属解除できない", async (props) => {
  for (const operation of ["assignRole", "removeMember"]) {
    const response = await props.request.post(
      `${E2E_SERVER_ORIGINS.api}/api/trpc/access.${operation}`,
      {
        data: {
          service: "business",
          scope: "demo-store",
          membershipId: "customer:demo-store:demo-customer",
          roleId: "demo-store:staff",
        },
      },
    );
    expect(response.status()).toBe(404);
  }
});

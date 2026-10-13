import { z } from "zod";
import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "@/e2e/fixtures";
import { E2E_SERVER_ORIGINS } from "@/e2e/server-policy";

const planResult = z.object({
  result: z.object({ data: z.object({ currentCode: z.string().nullable() }) }),
});

async function currentPlan(request: APIRequestContext, user = "demo-user") {
  const response = await request.get(`${E2E_SERVER_ORIGINS.web}/api/trpc/access.customerPlans`, {
    headers: { "x-demo-user": user },
  });
  expect(response.ok()).toBe(true);
  return planResult.parse(await response.json()).result.data.currentCode;
}

async function choosePlan(request: APIRequestContext, planCode: string | null) {
  const response = await request.post(
    `${E2E_SERVER_ORIGINS.web}/api/trpc/access.changeCustomerPlan`,
    { data: { planCode } },
  );
  expect(response.ok()).toBe(true);
}

test("一般ユーザー本人が会員情報からプランを選択・解除し、未設定でも再選択できる", async (props) => {
  const previous = await currentPlan(props.request);
  const other = await currentPlan(props.request, "demo-customer");
  try {
    await choosePlan(props.request, null);
    await props.page.goto(`${E2E_SERVER_ORIGINS.web}/`);
    await props.page.getByRole("link", { name: "会員情報", exact: true }).click();
    const plan = props.page.getByRole("combobox", { name: "利用プラン", exact: true });
    await expect(plan).toHaveValue("__no_customer_plan__");
    await plan.selectOption("customer:demo");
    const saved = props.page.waitForResponse(
      (response) =>
        response.url().includes("access.changeCustomerPlan") &&
        response.request().method() === "POST",
    );
    await props.page.getByRole("button", { name: "プランを変更", exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await props.page.reload();
    await expect(plan).toHaveValue("customer:demo");
    expect(await currentPlan(props.request, "demo-customer")).toBe(other);
    await plan.selectOption("__no_customer_plan__");
    const removed = props.page.waitForResponse(
      (response) =>
        response.url().includes("access.changeCustomerPlan") &&
        response.request().method() === "POST",
    );
    await props.page.getByRole("button", { name: "プランを変更", exact: true }).click();
    expect((await removed).ok()).toBe(true);
    await props.page.reload();
    await expect(plan).toHaveValue("__no_customer_plan__");
  } finally {
    await choosePlan(props.request, previous);
  }
});
test("個人プランは運営・企業専用会員・他人のID・企業プランから変更できない", async (props) => {
  const previous = await currentPlan(props.request);
  const operator = await props.request.post(
    `${E2E_SERVER_ORIGINS.admin}/api/trpc/access.assignPlan`,
    {
      data: { category: "customer", id: "customer:demo-user", planCode: null },
    },
  );
  expect(operator.status()).toBe(400);
  for (const input of [
    { planCode: "customer:demo", id: "customer:demo-customer" },
    { planCode: "customer:demo", service: "operator" },
  ]) {
    expect(
      (
        await props.request.post(`${E2E_SERVER_ORIGINS.web}/api/trpc/access.changeCustomerPlan`, {
          data: input,
        })
      ).status(),
    ).toBe(400);
  }

  for (const planCode of ["business:demo", "unknown"]) {
    expect(
      (
        await props.request.post(`${E2E_SERVER_ORIGINS.web}/api/trpc/access.changeCustomerPlan`, {
          data: { planCode },
        })
      ).status(),
    ).toBe(403);
  }

  expect(
    (
      await props.request.post(`${E2E_SERVER_ORIGINS.web}/api/trpc/access.changeCustomerPlan`, {
        headers: { "x-demo-user": "demo-member" },
        data: { planCode: "customer:demo" },
      })
    ).status(),
  ).toBe(403);
  expect(await currentPlan(props.request)).toBe(previous);
});

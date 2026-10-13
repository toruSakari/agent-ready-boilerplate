import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "@/e2e/fixtures";
import { E2E_SERVER_ORIGINS } from "@/e2e/server-policy";

async function readPlan(request: APIRequestContext, id: string) {
  const response = await request.get(
    `${E2E_SERVER_ORIGINS.admin}/api/trpc/access.organizationPlan`,
    {
      params: { input: JSON.stringify({ id }) },
    },
  );
  expect(response.ok()).toBe(true);
  return (await response.json()).result.data.code as string | null;
}

test("企業一覧の詳細から対象企業のプランだけを変更し、再表示でも保持する", async (props) => {
  const original = await readPlan(props.request, "demo-second");
  const other = await readPlan(props.request, "demo-store");
  try {
    await props.page.goto(`${E2E_SERVER_ORIGINS.admin}/organizations`);
    await props.page.getByRole("textbox", { name: "企業名を検索", exact: true }).fill("デモ企業B");
    await props.page.getByRole("button", { name: "絞り込む", exact: true }).click();
    await props.page.getByRole("link", { name: "デモ企業Bを管理" }).click();
    const plan = props.page.getByRole("combobox", { name: "プラン", exact: true });
    await expect(plan).toHaveValue(original ?? "__unassigned_plan__");
    await expect(props.page.getByRole("combobox", { name: "対象企業" })).toHaveCount(0);
    await plan.selectOption("__unassigned_plan__");
    const saved = props.page.waitForResponse(
      (response) =>
        response.url().includes("access.assignPlan") && response.request().method() === "POST",
    );
    await props.page.getByRole("button", { name: "プランを変更", exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await props.page.reload();
    await expect(plan).toHaveValue("__unassigned_plan__");
    expect(await readPlan(props.request, "demo-second")).toBeNull();
    expect(await readPlan(props.request, "demo-store")).toBe(other);
    if (original !== null) {
      await plan.selectOption(original);
      const assigned = props.page.waitForResponse(
        (response) =>
          response.url().includes("access.assignPlan") && response.request().method() === "POST",
      );
      await props.page.getByRole("button", { name: "プランを変更", exact: true }).click();
      expect((await assigned).ok()).toBe(true);
      await props.page.reload();
      await expect(plan).toHaveValue(original);
      expect(await readPlan(props.request, "demo-store")).toBe(other);
    }
  } finally {
    const restored = await props.request.post(
      `${E2E_SERVER_ORIGINS.admin}/api/trpc/access.assignPlan`,
      {
        data: { category: "business", id: "demo-second", planCode: original },
      },
    );
    expect(restored.ok()).toBe(true);
  }

  const removed = await props.page.goto(`${E2E_SERVER_ORIGINS.admin}/plans`);
  expect(removed?.status()).toBe(404);
  await expect(
    props.page.getByRole("link", { name: "一般ユーザープラン", exact: true }),
  ).toHaveCount(0);
});

import { Suspense } from "react";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vite-plus/test";
import { createAccessTestHarness } from "#admin/test/access-harness.tsx";
import { PlanAssignment } from "#admin/features/manage-plans/ui/plan-assignment.tsx";
import { UNASSIGNED_PLAN_OPTION } from "#admin/features/manage-plans/model/plan-assignment.ts";

afterEach(cleanup);
it.each([
  { selection: "standard", expected: "standard" },
  { selection: UNASSIGNED_PLAN_OPTION, expected: null },
])("プランの割当フォーム" + " / " + "選択 $selection をAPIへ明示的に渡す", async (props) => {
  const harness = createAccessTestHarness({
    "access.plans": {
      data: [{ code: "standard", name: "標準プラン", category: "business", permissions: [] }],
    },
    "access.assignPlan": { data: undefined },
  });
  render(
    <Suspense fallback={<span>読み込み中</span>}>
      <PlanAssignment category="business" candidates={[{ value: "company-a", label: "企業A" }]} />
    </Suspense>,
    { wrapper: harness.Providers },
  );
  const target = await screen.findByRole("combobox", { name: "対象企業" });
  fireEvent.change(target, { target: { value: "company-a" } });
  fireEvent.change(screen.getByRole("combobox", { name: "プラン" }), {
    target: { value: props.selection },
  });
  fireEvent.click(screen.getByRole("button", { name: "プランを割り当てる" }));
  await waitFor(() =>
    expect(harness.requests).toContainEqual({
      path: "access.assignPlan",
      input: { category: "business", id: "company-a", planCode: props.expected },
    }),
  );
  harness.queryClient.clear();
});

it("プランの割当フォーム" + " / " + "対象未選択のまま更新しない", async () => {
  const harness = createAccessTestHarness({
    "access.plans": { data: [] },
    "access.assignPlan": { data: undefined },
  });
  render(
    <Suspense fallback={<span>読み込み中</span>}>
      <PlanAssignment category="business" candidates={[]} />
    </Suspense>,
    { wrapper: harness.Providers },
  );
  fireEvent.change(await screen.findByRole("combobox", { name: "プラン" }), {
    target: { value: UNASSIGNED_PLAN_OPTION },
  });
  fireEvent.click(screen.getByRole("button", { name: "プランを割り当てる" }));
  expect(await screen.findByText("対象企業を正しく入力してください")).toBeInTheDocument();
  expect(harness.requests.some((r) => r.path === "access.assignPlan")).toBe(false);
  harness.queryClient.clear();
});

import { Suspense } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vite-plus/test";
import { createAccessTestHarness } from "#admin/test/access-harness.tsx";
import { PlanAssignment } from "#admin/features/manage-plans/ui/plan-assignment.tsx";
import { UNASSIGNED_PLAN_OPTION } from "#admin/features/manage-plans/model/plan-assignment.ts";

afterEach(cleanup);
it.each([
  { current: "standard", selected: UNASSIGNED_PLAN_OPTION, expected: null },
  { current: null, selected: "standard", expected: "standard" },
])("企業詳細のプラン変更 / 現在 $current → $expected", async (props) => {
  const harness = createAccessTestHarness({
    "access.plans": {
      data: [{ code: "standard", name: "標準プラン", category: "business", permissions: [] }],
    },
    "access.assignPlan": { data: undefined },
  });
  render(
    <Suspense fallback={<span>読み込み中</span>}>
      <PlanAssignment
        category="business"
        candidates={[{ value: "company-b", label: "企業B" }]}
        fixedTarget={{ id: "company-a", name: "企業A", planCode: props.current }}
      />
    </Suspense>,
    { wrapper: harness.Providers },
  );
  const plan = await screen.findByRole("combobox", { name: "プラン" });
  expect(plan).toHaveValue(props.current ?? UNASSIGNED_PLAN_OPTION);
  expect(screen.queryByRole("combobox", { name: "対象企業" })).not.toBeInTheDocument();
  expect(screen.getByText("企業A")).toBeInTheDocument();
  fireEvent.change(plan, { target: { value: props.selected } });
  fireEvent.click(screen.getByRole("button", { name: "プランを変更" }));
  await waitFor(() =>
    expect(harness.requests).toContainEqual({
      path: "access.assignPlan",
      input: { category: "business", id: "company-a", planCode: props.expected },
    }),
  );
  harness.queryClient.clear();
});

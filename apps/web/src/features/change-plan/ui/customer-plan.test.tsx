import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { CustomerPlan } from "#web/features/change-plan/ui/customer-plan.tsx";

const mocks = vi.hoisted(() => ({ change: vi.fn(), currentCode: null as string | null }));
vi.mock("#web/features/change-plan/api/use-customer-plan.ts", () => ({
  useCustomerPlans: () => ({
    currentCode: mocks.currentCode,
    plans: [{ code: "customer:demo", name: "通常会員デモ" }],
  }),
  useChangeCustomerPlan: () => ({ mutateAsync: mocks.change }),
}));
afterEach(cleanup);
beforeEach(() => {
  mocks.change.mockReset();
  mocks.currentCode = null;
});
it("未設定の本人がプランを選び、IDや会員種別を送らずに変更する", async () => {
  render(<CustomerPlan />);
  expect(screen.getByRole("combobox", { name: "利用プラン" })).toHaveValue("__no_customer_plan__");
  expect(screen.queryByLabelText("対象ユーザー")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "利用プラン" }), {
    target: { value: "customer:demo" },
  });
  fireEvent.click(screen.getByRole("button", { name: "プランを変更" }));
  await waitFor(() => expect(mocks.change).toHaveBeenCalledWith({ planCode: "customer:demo" }));
});
it("現在のプランを表示し、解除を明示的なnullとして送る", async () => {
  mocks.currentCode = "customer:demo";
  render(<CustomerPlan />);
  expect(screen.getByRole("combobox", { name: "利用プラン" })).toHaveValue("customer:demo");
  fireEvent.change(screen.getByRole("combobox", { name: "利用プラン" }), {
    target: { value: "__no_customer_plan__" },
  });
  fireEvent.click(screen.getByRole("button", { name: "プランを変更" }));
  await waitFor(() => expect(mocks.change).toHaveBeenCalledWith({ planCode: null }));
});

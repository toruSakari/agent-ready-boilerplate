import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { CancelOrder } from "#web/features/cancel-order/ui/cancel-order.tsx";
import type { CustomerOrder } from "#web/entities/customer-order/index.ts";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  reset: vi.fn(),
  pending: false,
  error: null as unknown,
}));
vi.mock("#web/features/cancel-order/api/cancel-order.ts", () => ({
  useCancelCustomerOrder: () => ({
    mutate: mocks.mutate,
    reset: mocks.reset,
    isPending: mocks.pending,
    error: mocks.error,
  }),
}));
const order: CustomerOrder = {
  id: "00000000-0000-4000-8000-000000000001",
  tenantId: "demo-store",
  customerId: "sample-customer",
  status: "confirmed",
  lines: [{ sku: "sample-item", name: "商品", quantity: 1, unitPrice: 2400 }],
  total: 2400,
  createdAt: "2026-10-01T00:00:00.000Z",
  version: 3,
  reservationId: "sample-reservation",
  paymentStatus: "pending",
};
beforeEach(() => {
  mocks.mutate.mockReset();
  mocks.reset.mockReset();
  mocks.pending = false;
  mocks.error = null;
});
afterEach(cleanup);
describe("本人注文の取消確認", () => {
  it("確認を開くだけでは送信せず、確定時に表示中の版を送信する", async () => {
    const user = userEvent.setup();
    render(<CancelOrder order={order} />);
    await user.click(screen.getByRole("button", { name: "注文を取り消す" }));
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "注文の取消を確定する" }));
    expect(mocks.mutate).toHaveBeenCalledWith({ id: order.id, version: 3 }, expect.any(Object));
  });
  it("出荷後は取消を提示しない", () => {
    render(<CancelOrder order={{ ...order, status: "shipped" }} />);
    expect(screen.queryByRole("button", { name: "注文を取り消す" })).not.toBeInTheDocument();
  });
  it("送信中は重複確定と確認画面の閉鎖を止める", async () => {
    const user = userEvent.setup();
    const view = render(<CancelOrder order={order} />);
    await user.click(screen.getByRole("button", { name: "注文を取り消す" }));
    mocks.pending = true;
    view.rerender(<CancelOrder order={order} />);
    expect(screen.getByRole("button", { name: "注文を取り消しています…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "戻る" })).toBeDisabled();
  });
  it("失敗の内部本文を表示せず、確認画面を保持する", async () => {
    const user = userEvent.setup();
    const view = render(<CancelOrder order={order} />);
    await user.click(screen.getByRole("button", { name: "注文を取り消す" }));
    mocks.error = { message: "secret_database_detail", data: { code: "CONFLICT" } };
    view.rerender(<CancelOrder order={order} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "データが競合しています。再読み込みしてください",
    );
    expect(screen.queryByText("secret_database_detail")).not.toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeVisible();
  });
});

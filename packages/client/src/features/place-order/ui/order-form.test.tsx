import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vite-plus/test";
import userEvent from "@testing-library/user-event";
import { OrderForm } from "#client/features/place-order/ui/order-form";

afterEach(cleanup);

describe("OrderFormの注文入力", () => {
  it("編集した注文明細を送信する", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<OrderForm isPending={false} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("数量"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "注文する" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        [
          {
            sku: "SKU-EDGE-MUG",
            name: "Edge Mug",
            quantity: 3,
            unitPrice: 2400,
          },
        ],
        false,
      ),
    );
  });
});

// 空欄・範囲外・非整数を同じ送信経路で試し、エラーのARIA関連付けと入力へのフォーカスも確認する。
it.each(["", "0", "101", "1.5"])(
  "不正な数量 %s を送信せず項目エラーを表示する",
  async (quantity) => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<OrderForm isPending={false} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("数量"), { target: { value: quantity } });
    fireEvent.click(screen.getByRole("button", { name: "注文する" }));
    const error = await screen.findByRole("alert");
    const input = screen.getByLabelText("数量");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(error.id);
    await waitFor(() => expect(input).toHaveFocus());
    expect(onSubmit).not.toHaveBeenCalled();
  },
);
it("文字列を整えて下書きの状態と一緒に送信する", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<OrderForm isPending={false} onSubmit={onSubmit} />);
  fireEvent.change(screen.getByLabelText("SKU"), { target: { value: " SKU-1 " } });
  fireEvent.click(screen.getByLabelText("下書きとして保存"));
  fireEvent.click(screen.getByRole("button", { name: "下書きを保存" }));
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(
      [expect.objectContaining({ sku: "SKU-1", quantity: 1 })],
      true,
    ),
  );
});

it("キーボードで下書きを選択して送信できる", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<OrderForm isPending={false} onSubmit={onSubmit} />);
  const checkbox = screen.getByRole("checkbox", { name: "下書きとして保存" });
  checkbox.focus();
  await user.keyboard("[Space]");
  expect(checkbox).toBeChecked();
  await user.click(screen.getByRole("button", { name: "下書きを保存" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.any(Array), true));
});

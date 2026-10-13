import { t as translate } from "#client/shared/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within, waitFor } from "storybook/test";
import { DEFAULT_ORDER_LINE } from "#client/features/place-order/model/form-defaults";
import { OrderForm } from "#client/features/place-order/ui/order-form";

const meta = {
  title: "Client/Features/PlaceOrder/OrderForm",
  component: OrderForm,
  args: { isPending: false, onSubmit: fn(async () => undefined) },
  parameters: { layout: "padded" },
} satisfies Meta<typeof OrderForm>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Pending: Story = {
  args: { isPending: true },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(canvas.getByLabelText("SKU")).toBeDisabled();
    await expect(
      canvas.getByRole("checkbox", { name: translate("下書きとして保存") }),
    ).toBeDisabled();
    await expect(canvas.getByRole("button", { name: translate("保存しています…") })).toBeDisabled();
  },
};
export const RequiredFields: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.clear(canvas.getByLabelText("SKU"));
    await userEvent.clear(canvas.getByLabelText(translate("商品名")));
    await userEvent.click(canvas.getByRole("button", { name: translate("注文する") }));
    await expect(await canvas.findByText(translate("SKUを入力してください"))).toBeVisible();
    await expect(canvas.getByText(translate("商品名を入力してください"))).toBeVisible();
    await expect(canvas.getByLabelText("SKU")).toHaveAttribute("aria-invalid", "true");
    await expect(props.args.onSubmit).not.toHaveBeenCalled();
  },
};
export const InvalidQuantity: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.clear(canvas.getByLabelText(translate("数量")));
    await userEvent.type(canvas.getByLabelText(translate("数量")), "0");
    await userEvent.click(canvas.getByRole("button", { name: translate("注文する") }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("数量は1以上にしてください");
    await expect(canvas.getByLabelText(translate("数量"))).toHaveAttribute("aria-invalid", "true");
    await expect(props.args.onSubmit).not.toHaveBeenCalled();
  },
};
// Radixのチェックボックスをキーボードで操作し、下書き指定が送信値へ反映されることを確認する。
export const SaveDraftWithKeyboard: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    const draft = canvas.getByRole("checkbox", { name: translate("下書きとして保存") });
    draft.focus();
    await userEvent.keyboard("[Space]");
    await expect(draft).toBeChecked();
    await userEvent.click(canvas.getByRole("button", { name: translate("下書きを保存") }));
    await waitFor(() =>
      expect(props.args.onSubmit).toHaveBeenCalledWith([DEFAULT_ORDER_LINE], true),
    );
  },
};
export const SubmitEditedQuantity: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.clear(canvas.getByLabelText(translate("数量")));
    await userEvent.type(canvas.getByLabelText(translate("数量")), "3");
    await userEvent.click(canvas.getByRole("button", { name: translate("注文する") }));
    await waitFor(() =>
      expect(props.args.onSubmit).toHaveBeenCalledWith(
        [{ ...DEFAULT_ORDER_LINE, quantity: 3 }],
        false,
      ),
    );
  },
};

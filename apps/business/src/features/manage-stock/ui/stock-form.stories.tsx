import { expect, userEvent, within } from "storybook/test";
import { t } from "@dev-template/client/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { StockForm } from "#business/features/manage-stock/ui/stock-form.tsx";

const meta = {
  title: "Business/Features/ManageStock/StockForm",
  component: StockForm,
  args: { id: "story-product", onHand: 12 },
  parameters: {
    fixtures: {
      mode: "business",
      queries: { "inventory.get": { data: { onHand: 12, reserved: 2, available: 10 } } },
      mutations: { "inventory.adjust": { data: { onHand: 12, reserved: 2, available: 10 } } },
    },
  },
} satisfies Meta<typeof StockForm>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Receive: Story = { args: { operation: "receive" } };
export const OutOfStock: Story = { args: { onHand: 0 } };

async function submitStock(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.clear(canvas.getByLabelText(t("棚卸し後の在庫数（個）")));
  await userEvent.type(canvas.getByLabelText(t("棚卸し後の在庫数（個）")), "5");
  await userEvent.click(canvas.getByRole("button", { name: t("棚卸しを反映") }));
}

export const Pending: Story = {
  parameters: { fixtures: { mutations: { "inventory.adjust": { pending: true } } } },
  play: async (props) => {
    await submitStock(props.canvasElement);
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("button", { name: t("保存中…") })).toBeDisabled();
    await expect(canvas.getByLabelText(t("棚卸し後の在庫数（個）"))).toBeDisabled();
  },
};
export const Conflict: Story = {
  parameters: {
    fixtures: {
      mutations: {
        "inventory.adjust": {
          error: "private",
          errorCode: "CONFLICT",
          errorReason: "STOCK_CHANGED",
        },
      },
    },
  },
  play: async (props) => {
    await submitStock(props.canvasElement);
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      t("在庫が変更されています。最新の在庫を確認してください"),
    );
    await expect(canvas.getByLabelText(t("棚卸し後の在庫数（個）"))).toHaveValue(5);
  },
};

import { t as translate } from "#client/shared/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { RouterOutputs } from "@dev-template/api-types";
import { expect, userEvent, within, waitFor } from "storybook/test";
import type { OrderSnapshot } from "#client/entities/order";
import { OrderActions } from "#client/features/manage-order/ui/order-actions";

const order = {
  id: "story-order-001",
  tenantId: "story-organization",
  customerId: "story-customer",
  status: "draft",
  lines: [{ sku: "MUG-001", name: "藍色のマグカップ", quantity: 2, unitPrice: 2400 }],
  total: 4800,
  createdAt: "2026-01-15T09:00:00.000Z",
  version: 1,
  reservationId: null,
} satisfies OrderSnapshot;
// Mutationの戻り値も公開API型へ合わせ、表示用fixtureだけが契約から逸脱しないようにする。
const updatedOrder = { ...order, version: 2 } satisfies RouterOutputs["order"]["update"];
const confirmedOrder = {
  ...order,
  status: "confirmed",
  version: 2,
} satisfies RouterOutputs["order"]["transition"];
const meta = {
  title: "Client/Features/ManageOrder/OrderActions",
  component: OrderActions,
  args: { order },
  parameters: {
    layout: "padded",
    fixtures: {
      mode: "business",
      queries: { "order.list": { data: [order] } },
      mutations: {
        "order.update": { data: updatedOrder },
        "order.transition": { data: confirmedOrder },
      },
    },
  },
} satisfies Meta<typeof OrderActions>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Draft: Story = {};
export const EditDraft: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: translate("明細を編集") }));
    await expect(canvas.getByLabelText("SKU")).toHaveValue("MUG-001");
    await expect(canvas.getByRole("button", { name: translate("明細を削除") })).toBeDisabled();
  },
};
export const AddAndRemoveLine: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: translate("明細を編集") }));
    await userEvent.click(canvas.getByRole("button", { name: translate("明細を追加") }));
    await expect(canvas.getAllByLabelText("SKU")).toHaveLength(2);
    await userEvent.click(canvas.getAllByRole("button", { name: "明細を削除" })[1]);
    await expect(canvas.getAllByLabelText("SKU")).toHaveLength(1);
  },
};
export const ValidationError: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: translate("明細を編集") }));
    await userEvent.clear(canvas.getByLabelText("SKU"));
    await userEvent.click(canvas.getByRole("button", { name: translate("変更を保存") }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      translate("SKUを入力してください"),
    );
    await expect(canvas.getByLabelText("SKU")).toHaveAttribute("aria-invalid", "true");
  },
};
export const SaveDraft: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: translate("明細を編集") }));
    await userEvent.clear(canvas.getByLabelText(translate("数量")));
    await userEvent.type(canvas.getByLabelText(translate("数量")), "3");
    await userEvent.click(canvas.getByRole("button", { name: translate("変更を保存") }));
    await expect(
      await canvas.findByRole("button", { name: translate("明細を編集") }),
    ).toBeEnabled();
    await expect(canvas.queryByRole("textbox", { name: "SKU" })).not.toBeInTheDocument();
  },
};
export const PendingTransition: Story = {
  parameters: { fixtures: { mutations: { "order.transition": { pending: true } } } },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: translate("注文を確定") }));
    await expect(await canvas.findByRole("status")).toHaveTextContent(
      translate("注文を更新しています…"),
    );
    await expect(canvas.getByRole("button", { name: translate("注文を確定") })).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: translate("注文をキャンセル") }),
    ).toBeDisabled();
  },
};
export const UpdateError: Story = {
  parameters: {
    fixtures: {
      mutations: { "order.update": { error: "注文の更新に失敗しました。再試行してください" } },
    },
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: translate("明細を編集") }));
    await userEvent.click(canvas.getByRole("button", { name: translate("変更を保存") }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      translate("処理に失敗しました。しばらくしてから再試行してください"),
    );
    await waitFor(() => expect(canvas.getByLabelText("SKU")).toBeEnabled());
    await expect(canvas.getByLabelText("SKU")).toHaveValue("MUG-001");
  },
};
export const ConfirmedBusinessOrder: Story = { args: { order: { ...order, status: "confirmed" } } };
export const ConfirmedCustomerOrder: Story = {
  args: { order: { ...order, status: "confirmed" } },
  parameters: { fixtures: { mode: "web" } },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(
      canvas.queryByRole("button", { name: translate("出荷する") }),
    ).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: translate("注文をキャンセル") })).toBeVisible();
  },
};
export const ShippedBusinessOrder: Story = { args: { order: { ...order, status: "shipped" } } };

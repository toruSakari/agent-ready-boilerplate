import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { t } from "@dev-template/client/i18n";
import { CancelOrder } from "#web/features/cancel-order/ui/cancel-order.tsx";

const order = {
  id: "00000000-0000-4000-8000-000000000001",
  tenantId: "demo-store",
  customerId: "sample-customer",
  status: "confirmed" as const,
  lines: [{ sku: "sample-item", name: "商品", quantity: 1, unitPrice: 2400 }],
  total: 2400,
  createdAt: "2026-10-01T00:00:00.000Z",
  version: 1,
  reservationId: "sample-reservation",
  paymentStatus: "pending" as const,
};
const meta = {
  title: "Web/Store/CancelOrder",
  component: CancelOrder,
  tags: ["autodocs"],
  args: { order },
  parameters: { fixtures: { mode: "web", authentication: "signed-in", organizationId: "" } },
} satisfies Meta<typeof CancelOrder>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Shipped: Story = { args: { order: { ...order, status: "shipped" } } };
export const ConfirmCancellation: Story = {
  play: async (props) => {
    await userEvent.click(
      within(props.canvasElement).getByRole("button", { name: t("注文を取り消す") }),
    );
    await expect(await within(document.body).findByRole("alertdialog")).toBeVisible();
  },
};
export const Sending: Story = {
  parameters: {
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      mutations: { "store.cancelOrder": { pending: true } },
    },
  },
  play: async (props) => {
    await userEvent.click(
      within(props.canvasElement).getByRole("button", { name: t("注文を取り消す") }),
    );
    await userEvent.click(
      within(document.body).getByRole("button", { name: t("注文の取消を確定する") }),
    );
    await expect(
      await within(document.body).findByRole("button", { name: t("注文を取り消しています…") }),
    ).toBeDisabled();
  },
};
export const Conflict: Story = {
  parameters: {
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      mutations: { "store.cancelOrder": { error: "private_detail", errorCode: "CONFLICT" } },
    },
  },
  play: async (props) => {
    await userEvent.click(
      within(props.canvasElement).getByRole("button", { name: t("注文を取り消す") }),
    );
    await userEvent.click(
      within(document.body).getByRole("button", { name: t("注文の取消を確定する") }),
    );
    await expect(await within(document.body).findByRole("alert")).toHaveTextContent(
      t("データが競合しています。再読み込みしてください"),
    );
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { OrderSnapshot } from "#client/entities/order";
import { OrderSummary } from "#client/entities/order/ui/order-summary";

const order = {
  id: "story-order-001",
  tenantId: "story-organization",
  customerId: "story-customer",
  status: "confirmed",
  statusLabel: "確定済み",
  lines: [{ sku: "MUG-001", name: "藍色のマグカップ", quantity: 2, unitPrice: 2400 }],
  total: 4800,
  createdAt: "2026-01-15T09:00:00.000Z",
  version: 2,
  reservationId: "story-reservation",
  paymentStatus: "authorized",
} satisfies OrderSnapshot;

const meta = {
  title: "Client/Entities/Order/OrderSummary",
  component: OrderSummary,
  args: { order },
  parameters: { layout: "padded" },
} satisfies Meta<typeof OrderSummary>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Confirmed: Story = {};
export const Draft: Story = {
  args: {
    order: {
      ...order,
      status: "draft",
      statusLabel: "下書き",
      reservationId: null,
      paymentStatus: null,
    },
  },
};
export const MultipleLines: Story = {
  args: {
    order: {
      ...order,
      lines: [
        ...order.lines,
        { sku: "TRAY-002", name: "木製トレー", quantity: 1, unitPrice: 3600 },
      ],
      total: 8400,
    },
    children: <p className="mt-4 text-sm text-muted-foreground">配送予定：1月20日</p>,
  },
};
// 注文状態と決済の非同期反映を別々に変え、表示側が両者を同じライフサイクルとみなさないようにする。
export const PaymentPending: Story = { args: { order: { ...order, paymentStatus: "pending" } } };
export const PaymentFailed: Story = { args: { order: { ...order, paymentStatus: "failed" } } };
export const Completed: Story = {
  args: {
    order: { ...order, status: "completed", statusLabel: "完了", paymentStatus: "captured" },
  },
};
export const Cancelled: Story = {
  args: {
    order: {
      ...order,
      status: "cancelled",
      statusLabel: "キャンセル済み",
      paymentStatus: "voided",
    },
  },
};
export const NoPaymentRequired: Story = {
  args: {
    order: {
      ...order,
      lines: [{ ...order.lines[0], unitPrice: 0 }],
      total: 0,
      paymentStatus: null,
    },
  },
};

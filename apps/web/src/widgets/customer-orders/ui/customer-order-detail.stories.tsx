import type { Meta, StoryObj } from "@storybook/react-vite";
import { CustomerOrderDetail } from "#web/widgets/customer-orders/ui/customer-order-detail.tsx";

const meta = {
  title: "Web/Store/CustomerOrderDetail",
  component: CustomerOrderDetail,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      queries: {
        "store.getOrder": {
          data: {
            id: "00000000-0000-4000-8000-000000000001",
            tenantId: "demo-store",
            customerId: "sample-customer",
            status: "confirmed",
            lines: [
              {
                sku: "sample-item",
                name: "毎日に使えるシンプルな商品",
                quantity: 1,
                unitPrice: 2400,
              },
            ],
            total: 2400,
            createdAt: "2026-10-01T00:00:00.000Z",
            version: 1,
            reservationId: "sample-reservation",
            paymentStatus: "pending",
            paidAmount: 0,
          },
        },
      },
    },
  },
  args: { id: "00000000-0000-4000-8000-000000000001" },
} satisfies Meta<typeof CustomerOrderDetail>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Loading: Story = {
  parameters: {
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      queries: { "store.getOrder": { pending: true } },
    },
  },
};
export const Error: Story = {
  parameters: {
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      queries: { "store.getOrder": { error: "fixture", errorCode: "INTERNAL_SERVER_ERROR" } },
    },
  },
};
export const OrderComplete: Story = { args: { complete: true } };

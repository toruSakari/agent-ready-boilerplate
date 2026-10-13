import type { Meta, StoryObj } from "@storybook/react-vite";
import { CustomerOrderCard } from "#web/entities/customer-order/ui/customer-order-card.tsx";

const meta = {
  title: "Web/Refined/CustomerOrderCard",
  component: CustomerOrderCard,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: {
    order: {
      id: "00000000-0000-4000-8000-000000000001",
      tenantId: "demo-store",
      customerId: "demo-customer",
      status: "draft" as const,
      lines: [{ sku: "sample", name: "商品", quantity: 1, unitPrice: 1200 }],
      total: 1200,
      createdAt: "2026-10-01T00:00:00.000Z",
      version: 1,
      reservationId: null,
      paymentStatus: null,
    },
  },
} satisfies Meta<typeof CustomerOrderCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

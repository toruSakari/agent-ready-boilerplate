import type { Meta, StoryObj } from "@storybook/react-vite";
import type { OrderSnapshot } from "@dev-template/client/entities/order";
import { BusinessOrderRow } from "#business/widgets/business-orders/ui/business-order-row.tsx";

const order = {
  id: "order-a",
  tenantId: "story-business",
  customerId: "customer-a",
  status: "draft",
  lines: [{ sku: "MUG-001", name: "藍色のマグカップ", quantity: 2, unitPrice: 2400 }],
  total: 4800,
  version: 1,
  reservationId: null,
  createdAt: "2026-10-01T00:00:00Z",
  paymentStatus: null,
} satisfies OrderSnapshot;

const meta = {
  title: "Business/Components/BusinessOrderRow",
  component: BusinessOrderRow,
  args: { order: order, organizationId: "story-business" },
  parameters: { fixtures: { mode: "business", organizationId: "story-business", image: "ready" } },
} satisfies Meta<typeof BusinessOrderRow>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <table>
      <tbody>
        <BusinessOrderRow {...args} />
      </tbody>
    </table>
  ),
};

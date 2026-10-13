import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrderEditForm } from "#client/features/manage-order/ui/order-edit-form";
import { useOrderEditor } from "#client/features/manage-order/model/use-order-editor";

const order = {
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
};
const meta = {
  title: "Client/Refined/OrderEditForm",
  component: OrderEditForm,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: {},
  render: () => {
    const editor = useOrderEditor(order);
    return <OrderEditForm editor={editor} />;
  },
} satisfies Meta<typeof OrderEditForm>;
export default meta;

type Story = StoryObj<Meta<typeof OrderEditForm>>;

export const Default: Story = {};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrderPagination } from "#client/widgets/order-dashboard/ui/order-pagination";
import { useOrders } from "#client/entities/order";

const meta = {
  title: "Client/Refined/OrderPagination",
  component: OrderPagination,
  tags: ["autodocs"],
  parameters: {
    fixtures: {
      mode: "business",
      authentication: "signed-in",
      organizationId: "demo-store",
      queries: { "order.list": { data: [] } },
    },
  },
  args: {},
  render: () => {
    const orders = useOrders();
    return <OrderPagination orders={orders} />;
  },
} satisfies Meta<typeof OrderPagination>;
export default meta;

type Story = StoryObj<Meta<typeof OrderPagination>>;

export const Default: Story = {};

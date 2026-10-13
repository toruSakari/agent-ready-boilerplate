import type { Meta, StoryObj } from "@storybook/react-vite";
import { CustomerOrderList } from "#web/widgets/customer-orders/ui/customer-order-list.tsx";

const meta = {
  title: "Web/Widgets/CustomerOrderList",
  component: CustomerOrderList,
  args: { filters: {} },
  parameters: {
    fixtures: { queries: { "store.listOrders": { data: { items: [], nextCursor: null } } } },
  },
} satisfies Meta<typeof CustomerOrderList>;
export default meta;
export const Empty: StoryObj<typeof meta> = {};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrderList } from "#client/widgets/order-dashboard/ui/order-list";
import { Populated, Loading } from "#client/widgets/order-dashboard/ui/order-dashboard.stories";

const meta = {
  title: "Client/Widgets/OrderList",
  component: OrderList,
  parameters: Populated.parameters,
} satisfies Meta<typeof OrderList>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const Pending: Story = { parameters: Loading.parameters };

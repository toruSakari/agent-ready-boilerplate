import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrderDashboardHero } from "#client/widgets/order-dashboard/ui/order-dashboard-hero";

const meta = {
  title: "Client/Refined/OrderDashboardHero",
  component: OrderDashboardHero,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: {},
} satisfies Meta<typeof OrderDashboardHero>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

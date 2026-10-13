import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrderBackendServices } from "#client/widgets/order-dashboard/ui/order-backend-services";

const meta = {
  title: "Client/Refined/OrderBackendServices",
  component: OrderBackendServices,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: {},
} satisfies Meta<typeof OrderBackendServices>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

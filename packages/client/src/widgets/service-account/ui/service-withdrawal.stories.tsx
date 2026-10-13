import type { Meta, StoryObj } from "@storybook/react-vite";
import { ServiceWithdrawal } from "#client/widgets/service-account/ui/service-withdrawal";

const meta = {
  title: "Client/Refined/ServiceWithdrawal",
  component: ServiceWithdrawal,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: { category: "business", onWithdrawn: () => {} },
} satisfies Meta<typeof ServiceWithdrawal>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

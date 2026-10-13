import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrderCreationPanel } from "#client/widgets/order-dashboard/ui/order-creation-panel";

const meta = {
  title: "Client/Refined/OrderCreationPanel",
  component: OrderCreationPanel,
  tags: ["autodocs"],
  parameters: {
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "demo-store",
      queries: {
        "access.session": {
          data: {
            userId: "storybook-account",
            channel: "customer",
            organizations: [],
            permissions: ["order:create"],
            platformPermissions: [],
            permissionCatalog: {},
          },
        },
      },
    },
  },
  args: {},
} satisfies Meta<typeof OrderCreationPanel>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

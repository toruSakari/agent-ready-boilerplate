import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScopeInvitation } from "#client/widgets/access-console/ui/scope-invitation";

const meta = {
  title: "Client/Refined/ScopeInvitation",
  component: ScopeInvitation,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: { scope: "demo-store", visibleRoles: [] },
} satisfies Meta<typeof ScopeInvitation>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

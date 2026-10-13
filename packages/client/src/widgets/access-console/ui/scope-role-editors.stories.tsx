import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScopeRoleEditors } from "#client/widgets/access-console/ui/scope-role-editors";

const meta = {
  title: "Client/Refined/ScopeRoleEditors",
  component: ScopeRoleEditors,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: {
    scope: "demo-store",
    catalog: { "order.read": "注文の閲覧" },
    roles: [],
    permissionLabels: { "order.read": "注文の閲覧" },
  },
} satisfies Meta<typeof ScopeRoleEditors>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

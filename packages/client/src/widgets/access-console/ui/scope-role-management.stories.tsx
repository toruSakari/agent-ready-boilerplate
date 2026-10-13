import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScopeRoleManagement } from "#client/widgets/access-console/ui/scope-role-management";
import { organizationId, memberFixtures, session } from "#storybook/fixtures";

const meta = {
  title: "Client/Widgets/ScopeRoleManagement",
  component: ScopeRoleManagement,
  args: { scope: organizationId },
  parameters: { fixtures: memberFixtures() },
} satisfies Meta<typeof ScopeRoleManagement>;
export default meta;

type Story = StoryObj<typeof ScopeRoleManagement>;

export const Default: Story = {};
export const ReadOnly: Story = {
  parameters: { fixtures: memberFixtures({ ...session, permissions: ["member.read"] }) },
};

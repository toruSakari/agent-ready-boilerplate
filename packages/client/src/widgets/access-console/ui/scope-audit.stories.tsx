import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScopeAudit } from "#client/widgets/access-console/ui/scope-audit";
import { organizationId, memberFixtures, session } from "#storybook/fixtures";

const meta = {
  title: "Client/Widgets/ScopeAudit",
  component: ScopeAudit,
  args: { scope: organizationId },
  parameters: { fixtures: memberFixtures() },
} satisfies Meta<typeof ScopeAudit>;
export default meta;

type Story = StoryObj<typeof ScopeAudit>;

export const Default: Story = {};
export const ReadOnly: Story = {
  parameters: { fixtures: memberFixtures({ ...session, permissions: ["member.read"] }) },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScopeMemberDirectory } from "#client/widgets/access-console/ui/scope-member-directory";
import { organizationId, memberFixtures, session } from "#storybook/fixtures";

const meta = {
  title: "Client/Widgets/ScopeMemberDirectory",
  component: ScopeMemberDirectory,
  args: { scope: organizationId },
  parameters: { fixtures: memberFixtures() },
} satisfies Meta<typeof ScopeMemberDirectory>;
export default meta;

type Story = StoryObj<typeof ScopeMemberDirectory>;

export const Default: Story = {};
export const ReadOnly: Story = {
  parameters: { fixtures: memberFixtures({ ...session, permissions: ["member.read"] }) },
};

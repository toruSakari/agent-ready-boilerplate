import type { Meta, StoryObj } from "@storybook/react-vite";
import { InvitationLinkDisplay } from "#client/widgets/access-console/ui/invitation-link-display";

const meta = {
  title: "Client/Refined/InvitationLinkDisplay",
  component: InvitationLinkDisplay,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: {
    scope: "demo-store",
    inviteLink: "https://example.test/invitations/accept#storybook-token",
  },
} satisfies Meta<typeof InvitationLinkDisplay>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { InvitationCategory } from "#client/widgets/access-console/ui/invitation-category";
import { useScopeInvitation } from "#client/widgets/access-console/model/use-scope-invitation";

const meta = {
  title: "Client/Refined/InvitationCategory",
  component: InvitationCategory,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: { scope: "demo-store" },
  render: (args) => {
    const state = useScopeInvitation(args.scope, []);
    return <InvitationCategory {...args} state={state} />;
  },
} satisfies Meta<typeof InvitationCategory>;
export default meta;

type Story = StoryObj<Meta<typeof InvitationCategory>>;

export const Default: Story = {};

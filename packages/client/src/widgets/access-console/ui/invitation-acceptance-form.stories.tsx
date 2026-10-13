import type { Meta, StoryObj } from "@storybook/react-vite";
import { InvitationAcceptanceForm } from "#client/widgets/access-console/ui/invitation-acceptance-form";
import { useInvitationAcceptance } from "#client/widgets/access-console/ui/use-invitation-acceptance";

const meta = {
  title: "Client/Refined/InvitationAcceptanceForm",
  component: InvitationAcceptanceForm,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: {},
  render: () => {
    const state = useInvitationAcceptance();
    return <InvitationAcceptanceForm state={{ ...state, authentication: "loading" }} />;
  },
} satisfies Meta<typeof InvitationAcceptanceForm>;
export default meta;

type Story = StoryObj<Meta<typeof InvitationAcceptanceForm>>;

export const Default: Story = {};

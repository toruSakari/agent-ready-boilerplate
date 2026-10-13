import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { AcceptInvitation } from "#client/widgets/access-console/ui/accept-invitation";

const meta = {
  title: "Client/Widgets/Accept Invitation",
  component: AcceptInvitation,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AcceptInvitation>;
export default meta;

type Story = StoryObj<typeof AcceptInvitation>;

export const MissingInvitationLink: Story = {
  parameters: {
    fixtures: { mode: "business", organizationId: "" },
    docs: {
      description: {
        story: "招待コンテキストの初期状態です。実際のURLやブラウザー保存には触れません。",
      },
    },
  },
  render: () => <AcceptInvitation />,
  play: async (props) => {
    await expect(await within(props.canvasElement).findByRole("alert")).toHaveTextContent(
      "招待リンクが無効か見つかりません。",
    );
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConsoleLayout } from "#client/widgets/access-console/ui/console-layout";
import { memberFixtures } from "#storybook/fixtures";

const meta = {
  title: "Client/Widgets/Console Layout",
  component: ConsoleLayout,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ConsoleLayout>;
export default meta;

type Story = StoryObj<typeof ConsoleLayout>;

export const LayoutWithOrganization: Story = {
  parameters: { fixtures: memberFixtures() },
  render: () => (
    <ConsoleLayout title="企業コンソール">
      <p>企業に関するページの見出しとナビゲーションです。</p>
    </ConsoleLayout>
  ),
};

export const LayoutWithoutOrganization: Story = {
  parameters: { fixtures: { mode: "admin", organizationId: "" } },
  render: () => (
    <ConsoleLayout title="運営コンソール">
      <p>企業を選択する前のナビゲーションです。</p>
    </ConsoleLayout>
  ),
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoreShell } from "#web/widgets/store-shell/ui/store-shell.tsx";

const meta = {
  title: "Web/Store/StoreShell",
  component: StoreShell,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    fixtures: { mode: "web", authentication: "signed-in", organizationId: "", queries: {} },
  },
  args: { children: <p>ストアのコンテンツ</p> },
} satisfies Meta<typeof StoreShell>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

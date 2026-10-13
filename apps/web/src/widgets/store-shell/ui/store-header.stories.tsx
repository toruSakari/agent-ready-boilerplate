import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoreHeader } from "#web/widgets/store-shell/ui/store-header.tsx";

const meta = {
  title: "Web/Refined/StoreHeader",
  component: StoreHeader,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: {},
} satisfies Meta<typeof StoreHeader>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

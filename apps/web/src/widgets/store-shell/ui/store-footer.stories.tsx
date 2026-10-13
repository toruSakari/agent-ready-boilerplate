import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoreFooter } from "#web/widgets/store-shell/ui/store-footer.tsx";

const meta = {
  title: "Web/Refined/StoreFooter",
  component: StoreFooter,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: {},
} satisfies Meta<typeof StoreFooter>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

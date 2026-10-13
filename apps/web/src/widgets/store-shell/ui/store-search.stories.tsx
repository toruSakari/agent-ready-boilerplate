import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoreSearch } from "#web/widgets/store-shell/ui/store-search.tsx";

const meta = {
  title: "Web/Refined/StoreSearch",
  component: StoreSearch,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: {},
} satisfies Meta<typeof StoreSearch>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

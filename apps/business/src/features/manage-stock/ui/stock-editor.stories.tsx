import type { Meta, StoryObj } from "@storybook/react-vite";
import { StockEditor } from "#business/features/manage-stock/ui/stock-editor.tsx";

const meta = {
  title: "Business/Features/ManageStock/StockEditor",
  component: StockEditor,
  args: { id: "story-product" },
  parameters: {
    fixtures: {
      mode: "business",
      queries: { "inventory.get": { data: { onHand: 12, reserved: 2, available: 10 } } },
      mutations: { "inventory.adjust": { data: { onHand: 12, reserved: 2, available: 10 } } },
    },
  },
} satisfies Meta<typeof StockEditor>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const OutOfStock: Story = {
  parameters: {
    fixtures: { queries: { "inventory.get": { data: { onHand: 0, reserved: 0, available: 0 } } } },
  },
};
export const ReadOnly: Story = {
  parameters: {
    fixtures: {
      queries: {
        "access.session": { data: { permissions: ["product.read"], platformPermissions: [] } },
      },
    },
  },
};

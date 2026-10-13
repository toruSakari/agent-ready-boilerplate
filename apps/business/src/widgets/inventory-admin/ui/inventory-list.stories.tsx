import type { Meta, StoryObj } from "@storybook/react-vite";
import { InventoryList } from "#business/widgets/inventory-admin/ui/inventory-list.tsx";

const meta = {
  title: "Business/Widgets/InventoryAdmin/InventoryList",
  component: InventoryList,
  parameters: {
    fixtures: {
      mode: "business",
      organizationId: "story-business",
      queries: {
        "inventory.list": {
          data: [
            {
              id: "stock-product",
              sku: "MUG-001",
              name: "藍色のマグカップ",
              createdAt: "2026-10-01T00:00:00Z",
              onHand: 12,
              reserved: 2,
              available: 10,
            },
          ],
        },
      },
    },
  },
} satisfies Meta<typeof InventoryList>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = {
  parameters: { fixtures: { queries: { "inventory.list": { data: [] } } } },
};

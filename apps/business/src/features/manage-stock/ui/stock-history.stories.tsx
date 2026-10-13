import type { Meta, StoryObj } from "@storybook/react-vite";
import { StockHistory } from "#business/features/manage-stock/ui/stock-history.tsx";

const meta = {
  title: "Business/Features/ManageStock/History",
  component: StockHistory,
  args: { id: "stock-product" },
  parameters: {
    fixtures: {
      mode: "business",
      queries: {
        "inventory.history": {
          data: [
            {
              id: "receive",
              operation: "receive",
              reason: "delivery",
              quantity: 10,
              beforeStock: 3,
              afterStock: 13,
              createdAt: "2026-10-02T00:00:00Z",
              actorName: "デモ担当者",
            },
            {
              id: "recount",
              operation: "recount",
              reason: "damage",
              quantity: 9,
              beforeStock: 13,
              afterStock: 9,
              createdAt: "2026-10-01T00:00:00Z",
              actorName: null,
            },
          ],
        },
      },
    },
  },
} satisfies Meta<typeof StockHistory>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = {
  parameters: { fixtures: { queries: { "inventory.history": { data: [] } } } },
};

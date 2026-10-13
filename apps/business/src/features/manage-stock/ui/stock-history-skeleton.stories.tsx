import type { Meta, StoryObj } from "@storybook/react-vite";
import { StockHistorySkeleton } from "#business/features/manage-stock/ui/stock-history-skeleton.tsx";

const meta = {
  title: "Business/Features/ManageStock/HistorySkeleton",
  component: StockHistorySkeleton,
} satisfies Meta<typeof StockHistorySkeleton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

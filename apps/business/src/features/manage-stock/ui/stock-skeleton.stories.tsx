import type { Meta, StoryObj } from "@storybook/react-vite";
import { StockSkeleton } from "#business/features/manage-stock/ui/stock-skeleton.tsx";

const meta = {
  title: "Business/Features/ManageStock/StockSkeleton",
  component: StockSkeleton,
} satisfies Meta<typeof StockSkeleton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const ReadOnly: Story = { args: { editable: false } };

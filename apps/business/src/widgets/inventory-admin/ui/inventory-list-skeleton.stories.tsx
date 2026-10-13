import type { Meta, StoryObj } from "@storybook/react-vite";
import { InventoryListSkeleton } from "#business/widgets/inventory-admin/ui/inventory-list-skeleton.tsx";

const meta = {
  title: "Business/Widgets/InventoryAdmin/ListSkeleton",
  component: InventoryListSkeleton,
} satisfies Meta<typeof InventoryListSkeleton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

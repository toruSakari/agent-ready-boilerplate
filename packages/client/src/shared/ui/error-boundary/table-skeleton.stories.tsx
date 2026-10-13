import type { Meta, StoryObj } from "@storybook/react-vite";
import { TableSkeleton } from "#client/shared/ui/error-boundary/table-skeleton.tsx";

const meta = {
  title: "Client/Shared/TableSkeleton",
  component: TableSkeleton,
  args: { columns: ["商品名", "SKU", "販売価格", "詳細"] },
} satisfies Meta<typeof TableSkeleton>;
export default meta;
export const Loading: StoryObj<typeof meta> = {};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { ListFilters } from "#client/widgets/list-filters/ui/list-filters.tsx";

const meta = {
  title: "Client/Widgets/ListFilters",
  component: ListFilters,
  args: {
    value: {},
    onChange: () => {},
    searchLabel: "商品名・SKU",
    options: [
      { value: "", label: "すべて" },
      { value: "in-stock", label: "在庫あり" },
    ],
    statusKey: "stock",
  },
} satisfies Meta<typeof ListFilters>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

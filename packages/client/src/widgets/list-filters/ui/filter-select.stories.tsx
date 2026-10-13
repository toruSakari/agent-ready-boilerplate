import type { Meta, StoryObj } from "@storybook/react-vite";
import { FilterSelect } from "#client/widgets/list-filters/ui/filter-select.tsx";

const meta = {
  title: "Client/Widgets/FilterSelect",
  component: FilterSelect,
  args: {
    label: "並び替え",
    value: "newest",
    options: [{ value: "newest", label: "新しい順" }],
    onChange: () => {},
  },
} satisfies Meta<typeof FilterSelect>;
export default meta;
export const Default: StoryObj<typeof meta> = {};

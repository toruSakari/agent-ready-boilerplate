import type { Meta, StoryObj } from "@storybook/react-vite";
import { FilterChips } from "#client/widgets/list-filters/ui/filter-chips.tsx";

const meta = {
  title: "Client/Widgets/FilterChips",
  component: FilterChips,
  args: { conditions: ["発送待ち", "検索：注文"], clear: () => {} },
} satisfies Meta<typeof FilterChips>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

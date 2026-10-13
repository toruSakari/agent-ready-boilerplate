import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusFilter } from "#client/widgets/list-filters/ui/status-filter.tsx";

const meta = {
  title: "Client/Widgets/StatusFilter",
  component: StatusFilter,
  args: {
    label: "状態で絞り込み",
    value: "",
    options: [
      { value: "", label: "すべて" },
      { value: "confirmed", label: "発送待ち" },
    ],
    onChange: () => {},
  },
} satisfies Meta<typeof StatusFilter>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

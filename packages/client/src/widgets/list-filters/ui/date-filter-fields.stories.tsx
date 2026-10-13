import type { Meta, StoryObj } from "@storybook/react-vite";
import { DateFilterFields } from "#client/widgets/list-filters/ui/date-filter-fields.tsx";

const meta = {
  title: "Client/Widgets/DateFilterFields",
  component: DateFilterFields,
  args: { value: {}, onChange: () => {} },
} satisfies Meta<typeof DateFilterFields>;
export default meta;
export const Default: StoryObj<typeof meta> = {};

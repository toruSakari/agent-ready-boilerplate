import type { Meta, StoryObj } from "@storybook/react-vite";
import { PriceFilterFields } from "#client/widgets/list-filters/ui/price-filter-fields.tsx";

const meta = {
  title: "Client/Widgets/PriceFilterFields",
  component: PriceFilterFields,
  args: { value: {}, onChange: () => {} },
} satisfies Meta<typeof PriceFilterFields>;
export default meta;
export const Default: StoryObj<typeof meta> = {};

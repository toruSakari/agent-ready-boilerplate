import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductList } from "#business/widgets/product-admin/ui/product-list.tsx";
import { Populated, Loading } from "#business/widgets/product-admin/ui/product-admin.stories.tsx";

const meta = {
  title: "Business/Widgets/ProductList",
  component: ProductList,
  parameters: Populated.parameters,
} satisfies Meta<typeof ProductList>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const Pending: Story = { parameters: Loading.parameters };

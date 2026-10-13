import type { Meta, StoryObj } from "@storybook/react-vite";
import { CartLineItem } from "#web/features/cart-actions/ui/cart-line-item.tsx";

const meta = {
  title: "Web/Refined/CartLineItem",
  component: CartLineItem,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: {
    line: { tenantId: "demo-store", sku: "sample", name: "商品", quantity: 1, unitPrice: 1200 },
  },
} satisfies Meta<typeof CartLineItem>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

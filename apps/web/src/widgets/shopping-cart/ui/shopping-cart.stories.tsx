import type { Meta, StoryObj } from "@storybook/react-vite";
import { ShoppingCart } from "#web/widgets/shopping-cart/ui/shopping-cart.tsx";

const meta = {
  title: "Web/Store/ShoppingCart",
  component: ShoppingCart,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    fixtures: { mode: "web", authentication: "signed-in", organizationId: "", queries: {} },
  },
  args: {},
} satisfies Meta<typeof ShoppingCart>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  beforeEach: async () => {
    const { clearTenantCart, addToCart } = await import("#web/entities/cart/index.ts");
    clearTenantCart("storybook-cart");
    addToCart(
      { tenantId: "storybook-cart", sku: "cart-item", name: "カート内の商品", unitPrice: 2400 },
      2,
    );
    return () => clearTenantCart("storybook-cart");
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkout } from "#web/widgets/checkout/ui/checkout.tsx";

const meta = {
  title: "Web/Store/Checkout",
  component: Checkout,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    fixtures: { mode: "web", authentication: "signed-in", organizationId: "", queries: {} },
  },
  args: {},
} satisfies Meta<typeof Checkout>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ReviewItems: Story = {
  beforeEach: async () => {
    const { clearTenantCart, addToCart } = await import("#web/entities/cart/index.ts");
    clearTenantCart("storybook-checkout");
    addToCart({
      tenantId: "storybook-checkout",
      sku: "checkout-item",
      name: "購入する商品",
      unitPrice: 2400,
    });
    return () => clearTenantCart("storybook-checkout");
  },
};

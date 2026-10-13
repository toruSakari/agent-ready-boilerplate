import type { Meta, StoryObj } from "@storybook/react-vite";
import { AddToCart } from "#web/features/cart-actions/ui/add-to-cart.tsx";

const meta = {
  title: "Web/Store/AddToCart",
  component: AddToCart,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    fixtures: { mode: "web", authentication: "signed-in", organizationId: "", queries: {} },
  },
  args: {
    product: {
      id: "sample-product",
      tenantId: "demo-store",
      organizationName: "暮らしのストア",
      sku: "sample-item",
      name: "毎日に使えるシンプルな商品",
      unitPrice: 2400,
      availableQuantity: 20,
      createdAt: "2026-10-01T00:00:00.000Z",
      images: [],
    },
  },
} satisfies Meta<typeof AddToCart>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const SoldOut: Story = { args: { product: { ...meta.args.product, availableQuantity: 0 } } };
export const FreeProduct: Story = { args: { product: { ...meta.args.product, unitPrice: 0 } } };

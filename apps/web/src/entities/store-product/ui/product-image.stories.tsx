import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductImage } from "#web/entities/store-product/ui/product-image.tsx";

const meta = {
  title: "Web/Store/ProductImage",
  component: ProductImage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    fixtures: { mode: "web", authentication: "signed-in", organizationId: "", queries: {} },
  },
  args: { tenantId: "demo-store", sku: "sample-item", name: "商品画像", className: "h-64 w-64" },
} satisfies Meta<typeof ProductImage>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Product } from "#business/entities/product/index.ts";
import { ProductCard } from "#business/entities/product/ui/product-card.tsx";
import { Badge } from "@dev-template/ui/badge";

const product = {
  id: "story-product-001",
  tenantId: "story-organization",
  sku: "MUG-001",
  name: "藍色のマグカップ",
  unitPrice: 2400,
  imageKey: null,
  images: [],
  createdAt: "2026-01-15T09:00:00.000Z",
} satisfies Product;
const meta = {
  title: "Business/Entities/Product/ProductCard",
  component: ProductCard,
  args: { product },
  parameters: { layout: "padded" },
} satisfies Meta<typeof ProductCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LongProductName: Story = {
  args: {
    product: {
      ...product,
      name: "毎日のコーヒーを楽しむための、手仕事で仕上げた藍色の大きなマグカップ",
    },
  },
};
export const FreeProduct: Story = { args: { product: { ...product, unitPrice: 0 } } };
export const WithDetails: Story = {
  args: {
    children: (
      <Badge variant="secondary" className="mt-4">
        数量限定
      </Badge>
    ),
  },
};

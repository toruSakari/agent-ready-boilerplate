import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductDetail } from "#web/widgets/product-detail/ui/product-detail.tsx";

const meta = {
  title: "Web/Store/ProductDetail",
  component: ProductDetail,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      queries: {
        "store.get": {
          data: {
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
      },
    },
  },
  args: { tenantId: "demo-store", sku: "sample-item" },
} satisfies Meta<typeof ProductDetail>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Loading: Story = {
  parameters: {
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      queries: { "store.get": { pending: true } },
    },
  },
};
export const Error: Story = {
  parameters: {
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      queries: { "store.get": { error: "fixture", errorCode: "INTERNAL_SERVER_ERROR" } },
    },
  },
};

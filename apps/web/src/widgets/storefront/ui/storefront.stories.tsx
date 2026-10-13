import type { Meta, StoryObj } from "@storybook/react-vite";
import { Storefront } from "#web/widgets/storefront/ui/storefront.tsx";

const meta = {
  title: "Web/Store/Storefront",
  component: Storefront,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      queries: {
        "store.list": {
          data: {
            items: [
              {
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
            ],
            nextCursor: null,
          },
        },
      },
    },
  },
  args: {},
} satisfies Meta<typeof Storefront>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Loading: Story = {
  parameters: {
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      queries: { "store.list": { pending: true } },
    },
  },
};
export const Error: Story = {
  parameters: {
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      queries: { "store.list": { error: "fixture", errorCode: "INTERNAL_SERVER_ERROR" } },
    },
  },
};
export const Empty: Story = {
  parameters: {
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      queries: { "store.list": { data: { items: [], nextCursor: null } } },
    },
  },
};

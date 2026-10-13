import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AdditionalProductImage } from "#business/features/manage-product-image/ui/additional-product-image.tsx";

const product = {
  id: "product-a",
  tenantId: "story-business",
  sku: "MUG-001",
  name: "藍色のマグカップ",
  unitPrice: 2400,
  imageKey: null,
  images: [],
  createdAt: "2026-10-01T00:00:00Z",
};
const image = { id: "image-a", key: "mug-side", createdAt: "2026-10-01T00:00:00Z" };

const meta = {
  title: "Business/Components/AdditionalProductImage",
  component: AdditionalProductImage,
  args: {
    product: product,
    image: image,
    number: 2,
    pending: false,
    onChange: fn(async () => undefined),
  },
  parameters: { fixtures: { mode: "business", organizationId: "story-business", image: "ready" } },
} satisfies Meta<typeof AdditionalProductImage>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <ul>
      <AdditionalProductImage {...args} />
    </ul>
  ),
};

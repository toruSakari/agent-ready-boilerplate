import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductRow } from "#business/widgets/product-admin/ui/product-row.tsx";

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

const meta = {
  title: "Business/Components/ProductRow",
  component: ProductRow,
  args: { product: product, organizationId: "story-business" },
  parameters: { fixtures: { mode: "business", organizationId: "story-business", image: "ready" } },
} satisfies Meta<typeof ProductRow>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <table>
      <tbody>
        <ProductRow {...args} />
      </tbody>
    </table>
  ),
};

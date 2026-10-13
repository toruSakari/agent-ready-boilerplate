import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckoutLineSummary } from "#web/features/checkout/ui/checkout-line-summary.tsx";

const meta = {
  title: "Web/Refined/CheckoutLineSummary",
  component: CheckoutLineSummary,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: {
    line: { tenantId: "demo-store", sku: "sample", name: "商品", quantity: 1, unitPrice: 1200 },
  },
} satisfies Meta<typeof CheckoutLineSummary>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

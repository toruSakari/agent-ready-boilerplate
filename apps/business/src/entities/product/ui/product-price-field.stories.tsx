import { useForm } from "react-hook-form";
import { Form } from "@dev-template/ui/form";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductPriceField } from "#business/entities/product/ui/product-price-field.tsx";

const meta = {
  title: "Business/Components/ProductPriceField",
  component: ProductPriceField,
  args: { label: "価格（円）" },
  parameters: { fixtures: { mode: "business", organizationId: "story-business", image: "ready" } },
} satisfies Meta<typeof ProductPriceField>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const form = useForm({ defaultValues: { name: "藍色のマグカップ", unitPrice: 2400 } });
    return (
      <Form {...form}>
        <form>
          <ProductPriceField {...args} />
        </form>
      </Form>
    );
  },
};

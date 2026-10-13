import { useForm } from "react-hook-form";
import { Form } from "@dev-template/ui/form";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductNameField } from "#business/entities/product/ui/product-name-field.tsx";

const meta = {
  title: "Business/Components/ProductNameField",
  component: ProductNameField,
  args: {},
  parameters: { fixtures: { mode: "business", organizationId: "story-business", image: "ready" } },
} satisfies Meta<typeof ProductNameField>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const form = useForm({ defaultValues: { name: "藍色のマグカップ", unitPrice: 2400 } });
    return (
      <Form {...form}>
        <form>
          <ProductNameField {...args} />
        </form>
      </Form>
    );
  },
};

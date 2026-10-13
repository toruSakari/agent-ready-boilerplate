import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrderEditLineField } from "#client/features/manage-order/ui/line-field";
import { useForm } from "react-hook-form";
import { Form } from "@dev-template/ui/form";

const meta = {
  title: "Client/Refined/OrderEditLineField",
  component: OrderEditLineField,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: { index: 0, name: "sku" },
  render: (args) => {
    const form = useForm({
      defaultValues: { lines: [{ sku: "sample", name: "商品", quantity: 1, unitPrice: 1200 }] },
    });
    return (
      <Form {...form}>
        <OrderEditLineField {...args} />
      </Form>
    );
  },
} satisfies Meta<typeof OrderEditLineField>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Quantity: Story = { args: { name: "quantity" } };

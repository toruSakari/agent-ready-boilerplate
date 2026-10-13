import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrderCreationLineField } from "#client/features/place-order/ui/line-field";
import { useForm } from "react-hook-form";
import { Form } from "@dev-template/ui/form";

const meta = {
  title: "Client/Refined/OrderCreationLineField",
  component: OrderCreationLineField,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: { index: 0, name: "sku" },
  render: (args) => {
    const form = useForm({
      defaultValues: {
        lines: [{ sku: "sample", name: "商品", quantity: 1, unitPrice: 1200 }],
        draft: false,
      },
    });
    return (
      <Form {...form}>
        <OrderCreationLineField {...args} />
      </Form>
    );
  },
} satisfies Meta<typeof OrderCreationLineField>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Quantity: Story = { args: { name: "quantity" } };

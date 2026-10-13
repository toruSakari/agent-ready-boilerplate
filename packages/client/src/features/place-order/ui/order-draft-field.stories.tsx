import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrderDraftField } from "#client/features/place-order/ui/order-draft-field";
import { useForm } from "react-hook-form";
import { Form } from "@dev-template/ui/form";

const meta = {
  title: "Client/Refined/OrderDraftField",
  component: OrderDraftField,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: { pending: false },
  render: (args) => {
    const form = useForm({
      defaultValues: {
        lines: [{ sku: "sample", name: "商品", quantity: 1, unitPrice: 1200 }],
        draft: false,
      },
    });
    return (
      <Form {...form}>
        <OrderDraftField {...args} />
      </Form>
    );
  },
} satisfies Meta<typeof OrderDraftField>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Sending: Story = { args: { pending: true } };

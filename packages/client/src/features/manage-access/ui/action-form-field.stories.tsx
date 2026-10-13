import type { Meta, StoryObj } from "@storybook/react-vite";
import { ActionFormField } from "#client/features/manage-access/ui/action-form-field";
import { useForm } from "react-hook-form";
import { Form } from "@dev-template/ui/form";

const meta = {
  title: "Client/Refined/ActionFormField",
  component: ActionFormField,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: { definition: { name: "name", label: "表示名" } },
  render: (args) => {
    const form = useForm<Record<string, string>>({ defaultValues: { name: "サンプル担当者" } });
    return (
      <Form {...form}>
        <ActionFormField {...args} />
      </Form>
    );
  },
} satisfies Meta<typeof ActionFormField>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Select: Story = {
  args: {
    definition: { name: "name", label: "ロール", options: [{ value: "member", label: "担当者" }] },
  },
};

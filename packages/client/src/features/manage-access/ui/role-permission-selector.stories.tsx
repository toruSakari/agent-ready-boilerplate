import type { Meta, StoryObj } from "@storybook/react-vite";
import { RolePermissionSelector } from "#client/features/manage-access/ui/role-permission-selector";
import { useForm } from "react-hook-form";
import { Form } from "@dev-template/ui/form";

const meta = {
  title: "Client/Refined/RolePermissionSelector",
  component: RolePermissionSelector,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: { options: [{ code: "order.read", label: "注文の閲覧", checked: false, disabled: false }] },
  render: (args) => {
    const form = useForm({ defaultValues: { name: "担当者", permissions: [] as string[] } });
    return (
      <Form {...form}>
        <RolePermissionSelector {...args} />
      </Form>
    );
  },
} satisfies Meta<typeof RolePermissionSelector>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Restricted: Story = {
  args: {
    options: [
      { code: "order.read", label: "注文の閲覧", checked: true, disabled: false },
      { code: "order.write", label: "注文の変更", checked: false, disabled: true },
    ],
  },
};

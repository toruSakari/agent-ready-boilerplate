import { useForm } from "react-hook-form";
import { Form } from "@dev-template/ui/form";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { adminFixtures } from "#admin/test/admin-story-fixtures.ts";
import { BusinessIpFields } from "#admin/features/manage-organizations/ui/business-ip-fields.tsx";

const meta = {
  title: "Admin/Components/BusinessIpFields",
  component: BusinessIpFields,
  args: {},
  parameters: { fixtures: adminFixtures() },
} satisfies Meta<typeof BusinessIpFields>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const form = useForm({ defaultValues: { enabled: false, allowedIps: "203.0.113.10" } });
    return (
      <Form {...form}>
        <form>
          <BusinessIpFields />
        </form>
      </Form>
    );
  },
};

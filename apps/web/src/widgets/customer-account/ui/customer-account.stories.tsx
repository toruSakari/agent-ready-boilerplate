import type { Meta, StoryObj } from "@storybook/react-vite";
import { CustomerAccount } from "#web/widgets/customer-account/ui/customer-account.tsx";

const meta = {
  title: "Web/Widgets/Customer Account",
  component: CustomerAccount,
  parameters: {
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      queries: {
        "access.registration": {
          data: { registered: true, category: "customer", accountId: "story-customer" },
        },
        "access.customerPlans": {
          data: { currentCode: null, plans: [{ code: "customer:demo", name: "通常会員デモ" }] },
        },
      },
    },
  },
} satisfies Meta<typeof CustomerAccount>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Unregistered: Story = {
  parameters: {
    fixtures: {
      queries: {
        "access.registration": {
          data: { registered: false, category: "customer", accountId: null },
        },
      },
    },
  },
};

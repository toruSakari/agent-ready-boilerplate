import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrganizationPlan } from "#admin/features/manage-plans/ui/organization-plan.tsx";
import { adminFixtures } from "#admin/test/admin-story-fixtures.ts";

const meta = {
  title: "Admin/Features/Organization Plan",
  component: OrganizationPlan,
  args: { id: "storybook-north", name: "北のサンプル商店" },
  parameters: { fixtures: adminFixtures() },
} satisfies Meta<typeof OrganizationPlan>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Unassigned: Story = {
  parameters: {
    fixtures: {
      ...adminFixtures(),
      queries: { ...adminFixtures().queries, "access.organizationPlan": { data: { code: null } } },
    },
  },
};

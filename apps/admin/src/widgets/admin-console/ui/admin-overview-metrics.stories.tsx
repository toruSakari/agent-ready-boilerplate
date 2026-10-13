import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AccessOrganization, AccessUser } from "#admin/entities/directory/index.ts";
import { adminFixtures } from "#admin/test/admin-story-fixtures.ts";
import { AdminOverviewMetrics } from "#admin/widgets/admin-console/ui/admin-overview-metrics.tsx";

const organization = {
  id: "storybook-north",
  name: "北のサンプル商店",
  active: true,
  invitationsEnabled: true,
  memberCount: 2,
} satisfies AccessOrganization;
const user = {
  id: "user-a",
  category: "business",
  name: "サンプル管理者",
  email: "owner@example.test",
  memberships: [
    {
      id: "member-a",
      scope: "storybook-north",
      organizationName: "北のサンプル商店",
      roleName: "オーナー",
      roleId: "role-a",
    },
  ],
} satisfies AccessUser;
const meta = {
  title: "Admin/Components/AdminOverviewMetrics",
  component: AdminOverviewMetrics,
  args: { organizations: [organization], users: [user] },
  parameters: { fixtures: adminFixtures() },
} satisfies Meta<typeof AdminOverviewMetrics>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoPermission: Story = { args: { organizations: null, users: null } };

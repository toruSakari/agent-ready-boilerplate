import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AccessUser } from "#admin/entities/directory/index.ts";
import { adminFixtures, adminSession } from "#admin/test/admin-story-fixtures.ts";
import { AdminUserCard } from "#admin/widgets/admin-console/ui/admin-user-card.tsx";

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
  title: "Admin/Components/AdminUserCard",
  component: AdminUserCard,
  args: { user: user },
  parameters: { fixtures: adminFixtures() },
} satisfies Meta<typeof AdminUserCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const ReadOnly: Story = {
  parameters: { fixtures: adminFixtures({ ...adminSession, platformPermissions: [] }) },
};

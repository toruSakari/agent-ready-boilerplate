import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AccessUser } from "#admin/entities/directory/index.ts";
import { adminFixtures } from "#admin/test/admin-story-fixtures.ts";
import { DeleteUserRegistration } from "#admin/features/manage-users/ui/delete-user-registration.tsx";

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
  title: "Admin/Components/DeleteUserRegistration",
  component: DeleteUserRegistration,
  args: { user: user },
  parameters: { fixtures: adminFixtures() },
} satisfies Meta<typeof DeleteUserRegistration>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

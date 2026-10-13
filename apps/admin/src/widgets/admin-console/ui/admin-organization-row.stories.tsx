import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AccessOrganization } from "#admin/entities/directory/index.ts";
import { adminFixtures } from "#admin/test/admin-story-fixtures.ts";
import { AdminOrganizationRow } from "#admin/widgets/admin-console/ui/admin-organization-row.tsx";

const organization = {
  id: "storybook-north",
  name: "北のサンプル商店",
  active: true,
  invitationsEnabled: true,
  memberCount: 2,
} satisfies AccessOrganization;
const meta = {
  title: "Admin/Components/AdminOrganizationRow",
  component: AdminOrganizationRow,
  args: { organization: organization },
  parameters: { fixtures: adminFixtures() },
} satisfies Meta<typeof AdminOrganizationRow>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AccessOrganization } from "#admin/entities/directory/index.ts";
import { adminFixtures } from "#admin/test/admin-story-fixtures.ts";
import { AdminOrganizationsTable } from "#admin/widgets/admin-console/ui/admin-organizations-table.tsx";

const organization = {
  id: "storybook-north",
  name: "北のサンプル商店",
  active: true,
  invitationsEnabled: true,
  memberCount: 2,
} satisfies AccessOrganization;
const meta = {
  title: "Admin/Components/AdminOrganizationsTable",
  component: AdminOrganizationsTable,
  args: { organizations: [organization] },
  parameters: { fixtures: adminFixtures() },
} satisfies Meta<typeof AdminOrganizationsTable>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { organizations: [] } };

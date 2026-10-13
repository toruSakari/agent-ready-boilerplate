import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AccessOrganization } from "#admin/entities/directory/index.ts";
import { adminFixtures, adminSession } from "#admin/test/admin-story-fixtures.ts";
import { OrganizationDetailContent } from "#admin/widgets/admin-console/ui/organization-detail-content.tsx";

const organization = {
  id: "storybook-north",
  name: "北のサンプル商店",
  active: true,
  invitationsEnabled: true,
  memberCount: 2,
} satisfies AccessOrganization;
const meta = {
  title: "Admin/Components/OrganizationDetailContent",
  component: OrganizationDetailContent,
  args: { organization: organization, section: "overview" },
  parameters: { fixtures: adminFixtures() },
} satisfies Meta<typeof OrganizationDetailContent>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const ReadOnly: Story = {
  parameters: { fixtures: adminFixtures({ ...adminSession, platformPermissions: [] }) },
};

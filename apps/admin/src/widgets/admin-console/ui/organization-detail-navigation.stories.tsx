import type { Meta, StoryObj } from "@storybook/react-vite";
import { adminFixtures } from "#admin/test/admin-story-fixtures.ts";
import { OrganizationDetailNavigation } from "#admin/widgets/admin-console/ui/organization-detail-navigation.tsx";

const meta = {
  title: "Admin/Components/OrganizationDetailNavigation",
  component: OrganizationDetailNavigation,
  args: { organizationId: "storybook-north", section: "overview" },
  parameters: { fixtures: adminFixtures() },
} satisfies Meta<typeof OrganizationDetailNavigation>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrganizationFilters } from "#admin/widgets/admin-console/ui/organization-filters.tsx";
import { adminFixtures } from "#admin/test/admin-story-fixtures.ts";

const meta = {
  title: "Admin/Widgets/OrganizationFilters",
  component: OrganizationFilters,
  parameters: { fixtures: adminFixtures() },
} satisfies Meta<typeof OrganizationFilters>;
export default meta;
export const Default: StoryObj<typeof meta> = {};

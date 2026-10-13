import type { Meta, StoryObj } from "@storybook/react-vite";
import { AdminOrganizationResults } from "#admin/widgets/admin-console/ui/admin-organization-results.tsx";
import { adminFixtures } from "#admin/test/admin-story-fixtures.ts";

const meta = {
  title: "Admin/Widgets/AdminOrganizationResults",
  component: AdminOrganizationResults,
  args: { filters: {} },
  parameters: { fixtures: adminFixtures() },
} satisfies Meta<typeof AdminOrganizationResults>;
export default meta;
export const Default: StoryObj<typeof meta> = {};

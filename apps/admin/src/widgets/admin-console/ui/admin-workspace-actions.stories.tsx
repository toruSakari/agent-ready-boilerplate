import type { Meta, StoryObj } from "@storybook/react-vite";
import { adminFixtures } from "#admin/test/admin-story-fixtures.ts";
import { AdminWorkspaceActions } from "#admin/widgets/admin-console/ui/admin-workspace-actions.tsx";

const meta = {
  title: "Admin/Components/AdminWorkspaceActions",
  component: AdminWorkspaceActions,
  args: {},
  parameters: { fixtures: adminFixtures() },
} satisfies Meta<typeof AdminWorkspaceActions>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

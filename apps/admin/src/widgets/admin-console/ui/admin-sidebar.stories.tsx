import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { adminFixtures } from "#admin/test/admin-story-fixtures.ts";
import { AdminSidebar } from "#admin/widgets/admin-console/ui/admin-sidebar.tsx";

const meta = {
  title: "Admin/Components/AdminSidebar",
  component: AdminSidebar,
  args: { open: true, onClose: fn() },
  parameters: { fixtures: adminFixtures() },
} satisfies Meta<typeof AdminSidebar>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

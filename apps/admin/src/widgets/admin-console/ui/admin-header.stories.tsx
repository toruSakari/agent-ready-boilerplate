import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { adminFixtures } from "#admin/test/admin-story-fixtures.ts";
import { AdminHeader } from "#admin/widgets/admin-console/ui/admin-header.tsx";

const meta = {
  title: "Admin/Components/AdminHeader",
  component: AdminHeader,
  args: { open: false, onToggle: fn() },
  parameters: { fixtures: adminFixtures() },
} satisfies Meta<typeof AdminHeader>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

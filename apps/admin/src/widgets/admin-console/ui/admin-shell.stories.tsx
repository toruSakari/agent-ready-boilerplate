import type { Meta, StoryObj } from "@storybook/react-vite";
import { AdminShell } from "#admin/widgets/admin-console/ui/admin-shell.tsx";
import { adminFixtures } from "#admin/test/admin-story-fixtures.ts";

const meta = {
  title: "Admin/Widgets/AdminShell",
  component: AdminShell,
  tags: ["autodocs"],
  args: { children: <div>管理画面のコンテンツ</div> },
  parameters: { layout: "fullscreen", fixtures: adminFixtures() },
} satisfies Meta<typeof AdminShell>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } };

import type { Meta, StoryObj } from "@storybook/react-vite";
import { AdminAccess } from "#admin/widgets/admin-console/ui/admin-access.tsx";
import { adminFixtures, adminSession } from "#admin/test/admin-story-fixtures.ts";

const meta = {
  title: "Admin/Widgets/AdminAccess",
  component: AdminAccess,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", fixtures: adminFixtures() },
} satisfies Meta<typeof AdminAccess>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const AccessDenied: Story = {
  parameters: { fixtures: adminFixtures({ ...adminSession, platformPermissions: [] }) },
};
export const Loading: Story = {
  parameters: {
    fixtures: {
      ...adminFixtures(),
      queries: { ...adminFixtures().queries, "access.session": { pending: true } },
    },
  },
};
export const Error: Story = {
  parameters: {
    fixtures: {
      ...adminFixtures(),
      queries: {
        ...adminFixtures().queries,
        "access.session": { error: "取得できませんでした。" },
      },
    },
  },
};

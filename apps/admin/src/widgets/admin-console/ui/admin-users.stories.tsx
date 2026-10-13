import type { Meta, StoryObj } from "@storybook/react-vite";
import { AdminUsers } from "#admin/widgets/admin-console/ui/admin-users.tsx";
import { adminFixtures, adminSession } from "#admin/test/admin-story-fixtures.ts";

const meta = {
  title: "Admin/Widgets/AdminUsers",
  component: AdminUsers,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", fixtures: adminFixtures() },
} satisfies Meta<typeof AdminUsers>;
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

export const Empty: Story = {
  parameters: {
    fixtures: {
      ...adminFixtures(),
      queries: {
        ...adminFixtures().queries,
        "access.organizations": { data: [] },
        "access.users": { data: [] },
      },
    },
  },
};

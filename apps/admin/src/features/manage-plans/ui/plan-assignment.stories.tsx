import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlanAssignment } from "#admin/features/manage-plans/ui/plan-assignment.tsx";
import { adminFixtures } from "#admin/test/admin-story-fixtures.ts";

const fixture = {
  ...adminFixtures(),
  queries: {
    ...adminFixtures().queries,
    "access.plans": {
      data: [
        { code: "standard", name: "標準プラン", category: "business", permissions: ["order:read"] },
      ],
    },
  },
};
const meta = {
  title: "Admin/Features/Plan Assignment",
  component: PlanAssignment,
  tags: ["autodocs"],
  args: {
    category: "business",
    candidates: [{ value: "storybook-north", label: "北のサンプル商店" }],
  },
  parameters: { fixtures: fixture },
} satisfies Meta<typeof PlanAssignment>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = {
  parameters: {
    fixtures: { ...fixture, queries: { ...fixture.queries, "access.plans": { data: [] } } },
  },
};
export const Loading: Story = {
  parameters: {
    fixtures: { ...fixture, queries: { ...fixture.queries, "access.plans": { pending: true } } },
  },
};
export const Error: Story = {
  parameters: {
    fixtures: {
      ...fixture,
      queries: { ...fixture.queries, "access.plans": { error: "取得できませんでした。" } },
    },
  },
};

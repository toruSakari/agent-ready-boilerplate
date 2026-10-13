import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScopeMemberCard } from "#client/widgets/access-console/ui/scope-member-card";

const meta = {
  title: "Client/Refined/ScopeMemberCard",
  component: ScopeMemberCard,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: {
    member: {
      id: "member-1",
      userId: "account-1",
      name: "サンプル担当者",
      email: "sample@example.test",
      category: "business",
      roleId: "member-role",
      roleName: "担当者",
      protectedRole: false,
    },
    scope: "demo-store",
    canReadEmail: true,
    canAssignRole: false,
    canRemove: false,
    visibleRoles: [],
  },
} satisfies Meta<typeof ScopeMemberCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

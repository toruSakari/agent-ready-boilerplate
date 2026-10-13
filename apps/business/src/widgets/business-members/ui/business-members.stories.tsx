import type { RouterOutputs } from "@dev-template/api-types";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AccessMember, AccessRole, AccessSession } from "@dev-template/client/entities/access";
import { BusinessNavigation } from "#business/widgets/business-navigation/index.ts";
import { BusinessMembers } from "#business/widgets/business-members/ui/business-members.tsx";

const organizationId = "storybook-north";
const session: AccessSession = {
  userId: "storybook-business-account",
  channel: "business",
  organizations: [
    { id: organizationId, name: "北のサンプル商店", roleName: "オーナー" },
    { id: "storybook-south", name: "南のサンプル工房", roleName: "閲覧担当" },
  ],
  permissions: [
    "member.read",
    "member.invite",
    "member.assign_role",
    "member.remove",
    "role.manage",
    "audit.read",
  ],
  platformPermissions: [],
  permissionCatalog: {
    "plan.manage": "プランの割当管理",
    "organization.read": "企業一覧の閲覧",
    "organization.manage": "企業の作成・変更・停止",
    "user.read": "全ユーザーの基本情報閲覧",
    "user.personal.read": "個人情報の閲覧",
    "user.delete": "アカウント削除",
    "member.read": "メンバー閲覧",
    "member.invite": "メンバー招待",
    "member.assign_role": "メンバーのロール変更",
    "member.remove": "所属解除",
    "role.manage": "カスタムロール管理",
    "audit.read": "監査ログ閲覧",
    "order:read": "注文閲覧",
    "order:create": "注文作成",
    "order:update": "注文変更",
    "product.read": "商品閲覧",
    "product.update": "商品管理",
  },
};
const roles: AccessRole[] = [
  {
    id: "storybook-owner-role",
    name: "オーナー",
    protectedRole: true,
    permissions: session.permissions,
  },
  {
    id: "storybook-reader-role",
    name: "注文の閲覧担当",
    protectedRole: false,
    permissions: ["order:read", "product.read"],
  },
];
const members: AccessMember[] = [
  {
    id: "storybook-owner-membership",
    userId: session.userId,
    category: "business",
    name: "サンプル管理者",
    email: "owner@example.test",
    roleId: "storybook-owner-role",
    roleName: "オーナー",
    protectedRole: true,
  },
  {
    id: "storybook-reader-membership",
    userId: "storybook-reader-account",
    category: "business",
    name: "サンプル閲覧者",
    email: null,
    roleId: "storybook-reader-role",
    roleName: "注文の閲覧担当",
    protectedRole: false,
  },
];
const audit: RouterOutputs["access"]["audit"] = [
  {
    id: "storybook-audit-entry",
    actorId: session.userId,
    scope: organizationId,
    action: "member.invited",
    targetId: "storybook-reader-membership",
    occurredAt: "2026-01-15T09:30:00.000Z",
  },
];

function memberFixtures(accessSession: AccessSession = session) {
  return {
    mode: "business",
    organizationId,
    queries: {
      "access.session": { data: accessSession },
      "access.members": { data: members },
      "access.roles": { data: roles },
      "access.rolePermissionCatalog": {
        data: Object.fromEntries(
          accessSession.permissions.map((permission) => [
            permission,
            accessSession.permissionCatalog[permission],
          ]),
        ),
      },
      "access.audit": { data: audit },
    },
  };
}

const meta = {
  title: "Business/Widgets/Business Members",
  component: BusinessMembers,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof BusinessMembers>;
export default meta;

type Story = StoryObj<typeof meta>;

export const BusinessMemberPage: Story = {
  parameters: { fixtures: memberFixtures() },
  render: () => <BusinessMembers navigation={<BusinessNavigation />} />,
};

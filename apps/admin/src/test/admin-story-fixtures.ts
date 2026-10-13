import type { RouterOutputs } from "@dev-template/api-types";
import type { AccessMember, AccessRole, AccessSession } from "@dev-template/client/entities/access";
import type { AccessOrganization } from "#admin/entities/directory/index.ts";

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
const organizations: AccessOrganization[] = [
  {
    id: organizationId,
    name: "北のサンプル商店",
    active: true,
    invitationsEnabled: true,
    memberCount: 2,
  },
  {
    id: "storybook-south",
    name: "南のサンプル工房",
    active: false,
    invitationsEnabled: false,
    memberCount: 1,
  },
];
const users: RouterOutputs["access"]["users"] = [
  {
    id: session.userId,
    category: "business",
    name: "サンプル管理者",
    email: "owner@example.test",
    memberships: [
      {
        id: "storybook-owner-membership",
        scope: organizationId,
        organizationName: "北のサンプル商店",
        roleName: "オーナー",
        roleId: "storybook-owner-role",
      },
    ],
  },
  {
    id: "storybook-operator-account",
    category: "operator",
    name: "サンプル運営者",
    email: null,
    memberships: [
      {
        id: "storybook-operator-membership",
        scope: "platform",
        organizationName: "運営",
        roleName: "運営管理者",
        roleId: "storybook-operator-role",
      },
    ],
  },
];
export const adminSession: AccessSession = {
  ...session,
  channel: "admin",
  platformPermissions: [
    "plan.manage",
    "organization.read",
    "organization.manage",
    "user.read",
    "user.personal.read",
    "member.read",
    "member.invite",
    "member.assign_role",
    "member.remove",
    "role.manage",
    "audit.read",
  ],
};
const adminMembers: AccessMember[] = [
  {
    id: "storybook-operator-membership",
    userId: "storybook-operator-account",
    category: "operator",
    name: "サンプル運営者",
    email: "operator@example.test",
    roleId: "storybook-operator-role",
    roleName: "運営管理者",
    protectedRole: true,
  },
];
const adminRoles: AccessRole[] = [
  {
    id: "storybook-operator-role",
    name: "運営管理者",
    protectedRole: true,
    permissions: adminSession.platformPermissions,
  },
];

// 未許可の一覧は空配列にせずAPIの403を再現し、許可されたセクションだけが残る表示を確認する。
export function adminFixtures(accessSession: AccessSession = adminSession) {
  return {
    mode: "admin",
    organizationId: "",
    queries: {
      ...directoryFixtures(accessSession),
      "access.session": { data: accessSession },
      "access.organizationPlan": { data: { code: "standard" } },
      "access.plans": {
        data: [
          {
            code: "standard",
            name: "標準プラン",
            category: "business",
            permissions: ["order:read"],
          },
        ],
      },
      "access.organizations": accessSession.platformPermissions.includes("organization.read")
        ? { data: organizations }
        : { error: "権限がありません。", errorCode: "FORBIDDEN" },
      "access.users": accessSession.platformPermissions.includes("user.read")
        ? { data: users }
        : { error: "権限がありません。", errorCode: "FORBIDDEN" },
      "access.members": accessSession.platformPermissions.includes("member.read")
        ? { data: adminMembers }
        : { error: "権限がありません。", errorCode: "FORBIDDEN" },
      "access.rolePermissionCatalog": {
        data: Object.fromEntries(
          accessSession.platformPermissions.map((permission) => [
            permission,
            accessSession.permissionCatalog[permission],
          ]),
        ),
      },
      "access.roles": accessSession.platformPermissions.includes("member.read")
        ? { data: adminRoles }
        : { error: "権限がありません。", errorCode: "FORBIDDEN" },
      "access.audit": accessSession.platformPermissions.includes("audit.read")
        ? { data: [] satisfies RouterOutputs["access"]["audit"] }
        : { error: "権限がありません。", errorCode: "FORBIDDEN" },
    },
  };
}

function directoryFixtures(accessSession: AccessSession) {
  return {
    "access.organizationPlanOptions": { data: [{ code: "standard", name: "標準" }] },
    "access.organizationDirectory": accessSession.platformPermissions.includes("organization.read")
      ? {
          data: {
            items: organizations.map((o) => ({ ...o, planCode: "standard" })),
            nextId: null,
          },
        }
      : { errorCode: "FORBIDDEN", error: "権限がありません" },
  };
}

import { t as translate } from "#client/shared/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type { AccessSession } from "#client/entities/access/model/types";
import { PermissionGate } from "#client/entities/access/ui/permission-gate";

const session: AccessSession = {
  userId: "storybook-permission-account",
  channel: "business",
  organizations: [],
  permissions: ["order:read"],
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
const meta = {
  title: "Client/Entities/Permission Gate",
  component: PermissionGate,
  tags: ["autodocs"],
  args: { required: ["order:read"], children: <p>権限を確認したページです。</p> },
  parameters: { fixtures: { mode: "business", queries: { "access.session": { data: session } } } },
} satisfies Meta<typeof PermissionGate>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Allowed: Story = {
  play: async (props) => {
    await expect(
      await within(props.canvasElement).findByText("権限を確認したページです。"),
    ).toBeVisible();
  },
};
export const MissingOneRequiredPermission: Story = {
  args: { required: ["order:read", "product.read"] },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("alert")).toHaveTextContent("権限がありません");
    await expect(canvas.queryByText("権限を確認したページです。")).not.toBeInTheDocument();
  },
};
export const ExplicitAnyPermission: Story = {
  args: { required: ["order:read", "product.read"], mode: "any" },
};
export const CheckingPermissions: Story = {
  parameters: { fixtures: { mode: "business", queries: { "access.session": { pending: true } } } },
};
export const SessionError: Story = {
  parameters: {
    fixtures: {
      mode: "business",
      queries: { "access.session": { error: "権限を確認できません" } },
    },
  },
  play: async (props) => {
    await expect(await within(props.canvasElement).findByRole("alert")).toHaveTextContent(
      translate("通信状況を確認して、もう一度お試しください。"),
    );
  },
};
// 運営権限だけを渡し、企業権限を代わりに使わず表示できる構成を確認する。
export const IndependentOperatorPermission: Story = {
  args: { required: ["member.read"], scope: "platform" },
  parameters: {
    fixtures: {
      mode: "admin",
      queries: {
        "access.session": {
          data: {
            ...session,
            channel: "admin",
            permissions: [],
            platformPermissions: ["member.read"],
          } satisfies AccessSession,
        },
      },
    },
  },
};

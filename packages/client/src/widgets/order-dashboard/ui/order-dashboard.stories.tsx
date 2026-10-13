import { t as translate } from "#client/shared/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import type { AccessSession } from "#client/entities/access";
import type { OrderSnapshot } from "#client/entities/order";
import { OrderDashboard } from "#client/widgets/order-dashboard";

const organizationId = "storybook-orders";
const session: AccessSession = {
  userId: "storybook-order-account",
  channel: "business",
  organizations: [{ id: organizationId, name: "サンプル商店", roleName: "注文担当" }],
  permissions: ["order:read", "order:create", "order:update"],
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
// 操作可能な状態を同時に並べ、企業と顧客で出荷・完了操作の表示が変わることを同じデータで確認する。
const orders: OrderSnapshot[] = [
  {
    id: "storybook-order-draft",
    tenantId: organizationId,
    customerId: "storybook-order-account",
    status: "draft",
    statusLabel: "下書き",
    lines: [{ sku: "STORY-TEA", name: "サンプルの紅茶", quantity: 2, unitPrice: 1200 }],
    total: 2400,
    createdAt: "2026-01-15T09:00:00.000Z",
    version: 1,
    reservationId: null,
    paymentStatus: null,
  },
  {
    id: "storybook-order-confirmed",
    tenantId: organizationId,
    customerId: "storybook-order-account",
    status: "confirmed",
    statusLabel: "確定",
    lines: [{ sku: "STORY-CUP", name: "サンプルのマグカップ", quantity: 1, unitPrice: 1800 }],
    total: 1800,
    createdAt: "2026-01-14T09:00:00.000Z",
    version: 2,
    reservationId: "storybook-reservation-confirmed",
    paymentStatus: "authorized",
  },
  {
    id: "storybook-order-shipped",
    tenantId: organizationId,
    customerId: "storybook-order-account",
    status: "shipped",
    statusLabel: "出荷済み",
    lines: [{ sku: "STORY-COFFEE", name: "サンプルのコーヒー", quantity: 3, unitPrice: 900 }],
    total: 2700,
    createdAt: "2026-01-13T09:00:00.000Z",
    version: 3,
    reservationId: "storybook-reservation-shipped",
    paymentStatus: "captured",
  },
];

function fixtures(accessSession: AccessSession = session) {
  return {
    mode: "business",
    organizationId,
    queries: {
      "access.session": { data: accessSession },
      "order.list": { data: orders },
    },
  };
}

const meta = {
  title: "Client/Widgets/Order Dashboard",
  component: OrderDashboard,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof OrderDashboard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  parameters: { fixtures: fixtures() },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByText("サンプルの紅茶")).toBeVisible();
    await expect(canvas.getByRole("button", { name: translate("注文を確定") })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: translate("出荷する") })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: translate("注文を完了") })).toBeEnabled();
  },
};

export const Loading: Story = {
  parameters: {
    fixtures: {
      mode: "business",
      organizationId,
      queries: { "access.session": { data: session }, "order.list": { pending: true } },
    },
  },
};

export const Error: Story = {
  parameters: {
    fixtures: {
      mode: "business",
      organizationId,
      queries: {
        "access.session": { data: session },
        "order.list": { error: "接続できません。しばらくしてから再度お試しください。" },
      },
    },
  },
  play: async (props) => {
    await expect(await within(props.canvasElement).findByRole("alert")).toHaveTextContent(
      translate("通信状況を確認して、もう一度お試しください。"),
    );
  },
};

export const Empty: Story = {
  parameters: {
    fixtures: {
      mode: "business",
      organizationId,
      queries: {
        "access.session": { data: session },
        "order.list": { data: [] satisfies OrderSnapshot[] },
      },
    },
  },
};

export const ReadOnly: Story = {
  parameters: { fixtures: fixtures({ ...session, permissions: ["order:read"] }) },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByText("サンプルの紅茶")).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: translate("注文する") }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: translate("明細を編集") }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("link", { name: translate("商品・画像を管理") }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("link", { name: translate("メンバー・権限") }),
    ).not.toBeInTheDocument();
  },
};

export const CustomerView: Story = {
  parameters: {
    fixtures: { ...fixtures({ ...session, channel: "customer" }), mode: "web" },
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByText("サンプルのマグカップ")).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: translate("出荷する") }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: translate("注文を完了") }),
    ).not.toBeInTheDocument();
  },
};

export const CreateOrderError: Story = {
  parameters: {
    fixtures: {
      ...fixtures({ ...session, channel: "customer", organizations: [] }),
      mode: "web",
      mutations: { "order.create": { error: "private_detail", errorCode: "CONFLICT" } },
    },
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: translate("注文する") }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      translate("データが競合しています。再読み込みしてください"),
    );
    await expect(canvas.getByRole("button", { name: translate("注文する") })).toBeEnabled();
  },
};

export const SharedNavigation: Story = {
  parameters: {
    fixtures: fixtures({ ...session, permissions: ["order:read", "product.read", "member.read"] }),
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByText("サンプルの紅茶")).toBeVisible();
    await expect(canvas.getByRole("link", { name: translate("企業を切り替える") })).toHaveAttribute(
      "href",
      "/",
    );
    await expect(canvas.getByRole("link", { name: translate("登録情報・退会") })).toHaveAttribute(
      "href",
      "/account",
    );
    await expect(
      canvas.queryByRole("link", { name: translate("商品・画像を管理") }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("link", { name: translate("メンバー・権限") }),
    ).not.toBeInTheDocument();
  },
};

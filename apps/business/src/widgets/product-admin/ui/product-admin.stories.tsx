import { t as translate } from "@dev-template/client/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type { AccessSession } from "@dev-template/client/entities/access";
import type { Product } from "#business/entities/product/index.ts";
import { ProductAdmin } from "#business/widgets/product-admin/index.ts";

const organizationId = "storybook-products";
const session: AccessSession = {
  userId: "storybook-product-account",
  channel: "business",
  organizations: [{ id: organizationId, name: "サンプル商店", roleName: "商品管理者" }],
  permissions: ["product.read", "product.update"],
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
const products: Product[] = [
  {
    id: "storybook-tea",
    tenantId: organizationId,
    sku: "STORY-TEA",
    name: "サンプルの紅茶",
    unitPrice: 1200,
    imageKey: "storybook/tea-main.png",
    images: [
      {
        id: "storybook-tea-main",
        key: "storybook/tea-main.png",
        createdAt: "2026-01-15T09:00:00.000Z",
      },
      {
        id: "storybook-tea-detail",
        key: "storybook/tea-detail.png",
        createdAt: "2026-01-15T09:00:00.000Z",
      },
    ],
    createdAt: "2026-01-15T09:00:00.000Z",
  },
  {
    id: "storybook-cup",
    tenantId: organizationId,
    sku: "STORY-CUP",
    name: "サンプルのマグカップ",
    unitPrice: 1800,
    imageKey: null,
    images: [],
    createdAt: "2026-01-14T09:00:00.000Z",
  },
  {
    id: "storybook-coffee",
    tenantId: organizationId,
    sku: "STORY-COFFEE",
    name: "サンプルのコーヒー・季節限定ブレンド",
    unitPrice: 900,
    imageKey: "storybook/coffee.png",
    images: [
      {
        id: "storybook-coffee-main",
        key: "storybook/coffee.png",
        createdAt: "2026-01-13T09:00:00.000Z",
      },
    ],
    createdAt: "2026-01-13T09:00:00.000Z",
  },
];

function fixtures(accessSession: AccessSession = session) {
  return {
    mode: "business",
    organizationId,
    image: "ready",
    queries: {
      "access.session": { data: accessSession },
      "product.list": { data: products },
    },
  };
}

const meta = {
  title: "Business/Widgets/Product Admin",
  component: ProductAdmin,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ProductAdmin>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  parameters: { fixtures: fixtures() },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("cell", { name: "サンプルの紅茶" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: translate("商品を登録") })).toHaveAttribute(
      "href",
      `/organizations/${organizationId}/products/new`,
    );
    const row = canvas.getByRole("cell", { name: "サンプルの紅茶" }).closest("tr");
    await expect(row).not.toBeNull();
    await expect(within(row!).getByRole("link", { name: translate("詳細を見る") })).toHaveAttribute(
      "href",
      `/organizations/${organizationId}/products/storybook-tea`,
    );
    await expect(canvas.queryByLabelText("サンプルの紅茶の画像を追加")).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: {
    fixtures: {
      mode: "business",
      organizationId,
      queries: { "access.session": { data: session }, "product.list": { pending: true } },
    },
  },
  play: async (props) => {
    await expect(await within(props.canvasElement).findByRole("status")).toHaveTextContent(
      translate("商品を読み込み中…"),
    );
  },
};

export const Error: Story = {
  parameters: {
    fixtures: {
      mode: "business",
      organizationId,
      queries: {
        "access.session": { data: session },
        "product.list": { error: "商品一覧への接続がタイムアウトしました。" },
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
        "product.list": { data: [] satisfies Product[] },
      },
    },
  },
};

export const ReadOnly: Story = {
  parameters: { fixtures: fixtures({ ...session, permissions: ["product.read"] }) },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("cell", { name: "サンプルの紅茶" })).toBeVisible();
    await expect(
      canvas.queryByRole("link", { name: translate("商品を登録") }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("link", { name: translate("注文サンプルへ") }),
    ).not.toBeInTheDocument();
    await expect(canvas.queryByLabelText("サンプルの紅茶の画像")).not.toBeInTheDocument();
  },
};

export const ImageError: Story = {
  parameters: { fixtures: { ...fixtures(), image: "error" } },
};

import { t as translate } from "@dev-template/client/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type { Permission } from "@dev-template/client/entities/access";
import { PermissionDeniedPage } from "@dev-template/client/access";
import { BusinessShell } from "#business/widgets/business-shell/index.ts";
import { BusinessNavigation } from "#business/widgets/business-navigation/index.ts";

const organizationId = "storybook-navigation";

function fixtures(permissions: Permission[]) {
  return {
    mode: "business",
    organizationId,
    queries: {
      "access.session": { data: { permissions, platformPermissions: [] } },
      "order.list": { data: [] },
    },
  };
}

const meta = {
  title: "Business/Widgets/Business Navigation",
  component: BusinessNavigation,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof BusinessNavigation>;
export default meta;

type Story = StoryObj<typeof meta>;

export const ConsoleNavigation: Story = {
  parameters: { fixtures: fixtures(["order:read", "product.read", "member.read"]) },
  render: () => (
    <BusinessShell title="企業コンソール">
      <p>現在の権限で利用できるページを選択してください。</p>
    </BusinessShell>
  ),
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("link", { name: translate("商品") })).toHaveAttribute(
      "href",
      `/organizations/${organizationId}/products`,
    );
    await expect(canvas.getByRole("link", { name: translate("メンバー・権限") })).toHaveAttribute(
      "href",
      `/organizations/${organizationId}/members`,
    );
    await expect(canvas.getByRole("link", { name: translate("注文") })).toHaveAttribute(
      "href",
      `/organizations/${organizationId}/orders`,
    );
  },
};

export const ProductOnlyNavigation: Story = {
  parameters: { fixtures: fixtures(["product.read"]) },
  render: () => <PermissionDeniedPage navigation={<BusinessNavigation />} />,
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("link", { name: translate("商品") })).toBeVisible();
    await expect(canvas.queryByRole("link", { name: translate("注文") })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("link", { name: translate("メンバー・権限") }),
    ).not.toBeInTheDocument();
  },
};

export const DashboardNavigation: Story = {
  parameters: { fixtures: fixtures(["order:read", "product.read", "member.read"]) },
  render: () => (
    <BusinessShell title="販売者センター">
      <p>販売業務の入口です。</p>
    </BusinessShell>
  ),
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("link", { name: translate("商品") })).toHaveAttribute(
      "href",
      `/organizations/${organizationId}/products`,
    );
    await expect(canvas.getByRole("link", { name: translate("メンバー・権限") })).toHaveAttribute(
      "href",
      `/organizations/${organizationId}/members`,
    );
    await expect(canvas.getByRole("link", { name: translate("企業を切り替える") })).toHaveAttribute(
      "href",
      "/",
    );
    await expect(canvas.getByRole("link", { name: translate("設定") })).toHaveAttribute(
      "href",
      `/organizations/${organizationId}/settings`,
    );
  },
};

export const NoReadPermissions: Story = {
  parameters: { fixtures: fixtures([]) },
  render: () => <PermissionDeniedPage navigation={<BusinessNavigation />} />,
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("alert")).toHaveTextContent("権限がありません");
    await expect(canvas.queryByRole("link", { name: translate("商品") })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("link", { name: translate("メンバー・権限") }),
    ).not.toBeInTheDocument();
  },
};

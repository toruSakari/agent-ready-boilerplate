import { t as translate } from "#client/shared/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type { AccessSession } from "#client/entities/access";
import { OrganizationPicker } from "#client/widgets/access-console/ui/organization-picker";
import { session, memberFixtures } from "#storybook/fixtures";

const meta = {
  title: "Client/Widgets/Organization Picker",
  component: OrganizationPicker,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof OrganizationPicker>;
export default meta;

type Story = StoryObj<typeof OrganizationPicker>;

export const ChooseOrganization: Story = {
  parameters: { fixtures: { ...memberFixtures(), organizationId: "" } },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("heading", { name: "北のサンプル商店" })).toBeVisible();
    await expect(canvas.getAllByRole("link", { name: "この企業に入る" })).toHaveLength(2);
  },
};

export const NoOrganizations: Story = {
  parameters: {
    fixtures: { ...memberFixtures({ ...session, organizations: [] }), organizationId: "" },
  },
  play: async (props) => {
    await expect(
      await within(props.canvasElement).findByText(
        translate("所属企業がありません。企業の担当者から招待を受けてください。"),
      ),
    ).toBeVisible();
  },
};

export const LoadingOrganizations: Story = {
  parameters: {
    fixtures: {
      mode: "business",
      organizationId: "",
      queries: { "access.session": { pending: true } },
    },
  },
};

export const OrganizationError: Story = {
  parameters: {
    fixtures: {
      mode: "business",
      organizationId: "",
      queries: { "access.session": { error: "所属企業を取得できませんでした。" } },
    },
  },
  play: async (props) => {
    await expect(await within(props.canvasElement).findByRole("alert")).toHaveTextContent(
      translate("通信状況を確認して、もう一度お試しください。"),
    );
  },
};

export const Shopper: Story = {
  parameters: {
    fixtures: {
      mode: "web",
      organizationId: "",
      queries: {
        "access.session": { data: { ...session, channel: "customer" } satisfies AccessSession },
      },
    },
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(
      await canvas.findByText(translate("企業への所属や招待なしで商品を購入できます。")),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("link", { name: translate("この企業に入る") }),
    ).not.toBeInTheDocument();
  },
};

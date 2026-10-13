import { t as translate } from "#client/shared/i18n";
import { session } from "#storybook/fixtures";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { OrganizationNavigation } from "#client/widgets/access-console/ui/organization-navigation";

const meta = {
  title: "Client/Widgets/OrganizationNavigation",
  component: OrganizationNavigation,
  args: { organizationId: "storybook-north" },
  parameters: {
    fixtures: {
      mode: "business",
      queries: { "access.session": { data: { ...session, permissions: ["order:read"] } } },
    },
  },
} satisfies Meta<typeof OrganizationNavigation>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Allowed: Story = {
  play: async (props) => {
    await expect(
      await within(props.canvasElement).findByRole("link", { name: translate("注文") }),
    ).toHaveAttribute("href", "/organizations/storybook-north");
  },
};
export const Denied: Story = {
  parameters: {
    fixtures: {
      mode: "business",
      queries: { "access.session": { data: { ...session, permissions: [] } } },
    },
  },
  play: async (props) => {
    await expect(
      within(props.canvasElement).queryByRole("link", { name: translate("注文") }),
    ).not.toBeInTheDocument();
  },
};
export const Loading: Story = {
  parameters: { fixtures: { mode: "business", queries: { "access.session": { pending: true } } } },
};
export const Error: Story = {
  parameters: {
    fixtures: {
      mode: "business",
      queries: { "access.session": { error: "権限を確認できませんでした。" } },
    },
  },
};
export const Operator: Story = { parameters: { fixtures: { mode: "admin" } } };

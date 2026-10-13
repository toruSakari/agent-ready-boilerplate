import { t as translate } from "@dev-template/client/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { BusinessIpSettings } from "#admin/features/manage-organizations/ui/business-ip-settings.tsx";

const meta = {
  title: "Admin/Features/Business IP Settings",
  component: BusinessIpSettings,
  args: { id: "storybook-north" },
  parameters: { fixtures: { mode: "admin" } },
} satisfies Meta<typeof BusinessIpSettings>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Disabled: Story = {};
export const Enabled: Story = {
  parameters: {
    fixtures: {
      mode: "admin",
      queries: {
        "access.businessIpPolicy": {
          data: { enabled: true, allowedIps: ["203.0.113.10/32", "2001:db8::/32"] },
        },
      },
    },
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("checkbox")).toBeChecked();
    await expect(canvas.getByRole("textbox")).toHaveValue("203.0.113.10/32\n2001:db8::/32");
  },
};
export const Loading: Story = {
  parameters: {
    fixtures: { mode: "admin", queries: { "access.businessIpPolicy": { pending: true } } },
  },
  play: async (props) => {
    await expect(
      within(props.canvasElement).getByText(translate("IP制限を確認しています…")),
    ).toBeVisible();
  },
};
export const Error: Story = {
  render: (args) => (
    <>
      <p>他の企業設定は利用できます。</p>
      <BusinessIpSettings {...args} />
    </>
  ),
  parameters: {
    fixtures: {
      mode: "admin",
      queries: { "access.businessIpPolicy": { error: "IP制限を取得できませんでした。" } },
    },
  },
  play: async (props) => {
    await expect(await within(props.canvasElement).findByRole("alert")).toHaveTextContent(
      translate("通信状況を確認して、もう一度お試しください。"),
    );
    await expect(
      within(props.canvasElement).getByText("他の企業設定は利用できます。"),
    ).toBeVisible();
  },
};

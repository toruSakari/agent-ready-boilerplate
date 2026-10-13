import { t as translate } from "@dev-template/client/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { BusinessIpPolicyForm } from "#admin/features/manage-organizations/ui/business-ip-policy-form.tsx";

const meta = {
  title: "Admin/Features/Business IP Policy Form",
  component: BusinessIpPolicyForm,
  args: { id: "storybook-north", policy: { enabled: false, allowedIps: [] } },
  parameters: {
    fixtures: {
      mode: "admin",
      mutations: { "access.updateBusinessIpPolicy": { data: undefined } },
    },
  },
} satisfies Meta<typeof BusinessIpPolicyForm>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Disabled: Story = {};
export const Enabled: Story = {
  args: {
    policy: { enabled: true, allowedIps: ["203.0.113.10", "198.51.100.0/24", "2001:db8::/32"] },
  },
};
export const Save: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("checkbox"));
    await userEvent.type(canvas.getByRole("textbox"), "203.0.113.10");
    await userEvent.click(canvas.getByRole("button", { name: translate("IP制限を保存") }));
    await expect(await canvas.findByRole("status")).toHaveTextContent(
      translate("IP制限を保存しました"),
    );
  },
};
export const EmptyAllowlist: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("checkbox"));
    await userEvent.click(canvas.getByRole("button", { name: translate("IP制限を保存") }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "許可IPを1〜50件入力してください",
    );
  },
};
export const InvalidAddress: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.type(canvas.getByRole("textbox"), "invalid-ip");
    await userEvent.click(canvas.getByRole("button", { name: translate("IP制限を保存") }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      translate("IPv4・IPv6またはCIDRで入力してください"),
    );
  },
};
export const SaveError: Story = {
  parameters: {
    fixtures: {
      mode: "admin",
      mutations: { "access.updateBusinessIpPolicy": { error: "IP制限を保存できませんでした。" } },
    },
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.type(canvas.getByRole("textbox"), "203.0.113.10");
    await userEvent.click(canvas.getByRole("button", { name: translate("IP制限を保存") }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      translate("処理に失敗しました。しばらくしてから再試行してください"),
    );
    await expect(canvas.getByRole("textbox")).toHaveValue("203.0.113.10");
  },
};
export const Saving: Story = {
  parameters: {
    fixtures: { mode: "admin", mutations: { "access.updateBusinessIpPolicy": { pending: true } } },
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: translate("IP制限を保存") }));
    await expect(await canvas.findByRole("button", { name: translate("保存中…") })).toBeDisabled();
    await expect(canvas.getByRole("textbox")).toBeDisabled();
    await expect(canvas.getByRole("checkbox")).toBeDisabled();
  },
};

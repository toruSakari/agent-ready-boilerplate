import { t as translate } from "@dev-template/client/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import type { AccessOrganization } from "#admin/entities/directory/index.ts";
import { OrganizationSettings } from "#admin/features/manage-organizations/ui/organization-settings.tsx";

const organization: AccessOrganization = {
  id: "storybook-north",
  name: "北のサンプル商店",
  active: true,
  invitationsEnabled: true,
  memberCount: 2,
};
const meta = {
  title: "Admin/Features/Organization Settings",
  component: OrganizationSettings,
  tags: ["autodocs"],
  args: { organization },
  parameters: { fixtures: { mode: "admin", organizationId: "" } },
} satisfies Meta<typeof OrganizationSettings>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Active: Story = {};

export const Suspended: Story = {
  args: { organization: { ...organization, active: false, invitationsEnabled: false } },
};

export const RenameOrganization: Story = {
  parameters: {
    fixtures: {
      mode: "admin",
      organizationId: "",
      mutations: { "access.updateOrganization": { data: undefined } },
    },
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.clear(canvas.getByRole("textbox", { name: translate("企業名") }));
    await userEvent.type(
      canvas.getByRole("textbox", { name: translate("企業名") }),
      "北の新しい商店",
    );
    await userEvent.click(canvas.getByRole("button", { name: translate("企業名を変更") }));
    await expect(await canvas.findByRole("status")).toHaveTextContent(
      translate("処理が完了しました"),
    );
  },
};

export const RenameError: Story = {
  parameters: {
    fixtures: {
      mode: "admin",
      organizationId: "",
      mutations: { "access.updateOrganization": { error: "企業を更新できませんでした。" } },
    },
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    const name = canvas.getByRole("textbox", { name: translate("企業名") });
    await userEvent.clear(name);
    await userEvent.type(name, "変更中の企業名");
    await userEvent.click(canvas.getByRole("button", { name: translate("企業名を変更") }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      translate("処理に失敗しました。しばらくしてから再試行してください"),
    );
    await expect(name).toHaveValue("変更中の企業名");
  },
};

export const RenamePending: Story = {
  parameters: {
    fixtures: {
      mode: "admin",
      organizationId: "",
      mutations: { "access.updateOrganization": { pending: true } },
    },
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: translate("企業名を変更") }));
    await expect(await canvas.findByRole("button", { name: translate("処理中…") })).toBeDisabled();
    await expect(canvas.getByRole("textbox", { name: translate("企業名") })).toBeDisabled();
  },
};

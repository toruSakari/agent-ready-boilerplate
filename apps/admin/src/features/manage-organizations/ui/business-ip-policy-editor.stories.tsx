import { t as translate } from "@dev-template/client/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { BusinessIpPolicyEditor } from "#admin/features/manage-organizations/ui/business-ip-policy-editor.tsx";

const meta = {
  title: "Admin/Features/Business IP Policy Editor",
  component: BusinessIpPolicyEditor,
  args: { id: "storybook-north" },
  parameters: { fixtures: { mode: "admin" } },
} satisfies Meta<typeof BusinessIpPolicyEditor>;
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
      within(props.canvasElement).getByText(translate("データを読み込み中…")),
    ).toBeVisible();
  },
};

export const English: Story = {
  globals: { locale: "en" },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(
      await canvas.findByRole("heading", { name: "Business screen IP restrictions" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("checkbox", { name: "Enable business screen IP restrictions" }),
    ).toBeVisible();
  },
};

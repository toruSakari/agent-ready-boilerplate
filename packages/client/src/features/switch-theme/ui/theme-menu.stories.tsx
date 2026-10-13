import { t as translate } from "#client/shared/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ThemeMenu } from "#client/features/switch-theme/ui/theme-menu";

const meta = {
  title: "Client/Features/SwitchTheme/ThemeMenu",
  component: ThemeMenu,
  parameters: { layout: "centered" },
} satisfies Meta<typeof ThemeMenu>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
// メニュー本体はPortalでcanvasの外へ出るため、項目は同じdocumentのbodyから探す。
export const OpenMenu: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: translate("テーマを選択") }));
    const page = within(props.canvasElement.ownerDocument.body);
    await expect(
      await page.findByRole("menuitemradio", { name: translate("ライト") }),
    ).toBeVisible();
    await expect(page.getByRole("menuitemradio", { name: translate("ダーク") })).toBeVisible();
    await expect(
      page.getByRole("menuitemradio", { name: translate("システム設定に合わせる") }),
    ).toBeVisible();
  },
};
export const SelectDark: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    const page = within(props.canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: translate("テーマを選択") }));
    await userEvent.click(await page.findByRole("menuitemradio", { name: translate("ダーク") }));
    await userEvent.click(canvas.getByRole("button", { name: translate("テーマを選択") }));
    await expect(
      await page.findByRole("menuitemradio", { name: translate("ダーク") }),
    ).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{Escape}");
  },
};
export const KeyboardMenu: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    const trigger = canvas.getByRole("button", { name: translate("テーマを選択") });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const page = within(props.canvasElement.ownerDocument.body);
    await expect(await page.findByRole("menu")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect(trigger).toHaveFocus();
  },
};

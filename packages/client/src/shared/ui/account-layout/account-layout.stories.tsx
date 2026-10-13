import { t as translate } from "#client/shared/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { AccountLayout } from "#client/shared/ui/account-layout/account-layout";

const meta = {
  title: "Client/Shared/Account Layout",
  component: AccountLayout,
  args: {
    title: "登録情報",
    headerAction: <button type="button">表示設定</button>,
    children: <p>サービスの登録情報です。</p>,
  },
} satisfies Meta<typeof AccountLayout>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(canvas.getByRole("heading", { name: "登録情報" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: translate("ホームへ") })).toHaveAttribute(
      "href",
      "/",
    );
    await expect(canvas.getByRole("button", { name: "表示設定" })).toBeVisible();
  },
};
export const WithoutHeaderAction: Story = {
  args: { headerAction: null },
  play: async (props) => {
    await expect(within(props.canvasElement).queryByRole("button")).not.toBeInTheDocument();
  },
};

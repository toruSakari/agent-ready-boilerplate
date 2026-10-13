import { t as translate } from "#client/shared/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within, waitFor } from "storybook/test";
import { AccessAction } from "#client/features/manage-access/ui/access-action";

const meta = {
  title: "Client/Features/ManageAccess/AccessAction",
  component: AccessAction,
  args: { label: "設定を更新", onAction: fn(async () => undefined) },
  parameters: { layout: "padded" },
} satisfies Meta<typeof AccessAction>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Destructive: Story = {
  args: { label: "所属を解除", confirmation: "この企業への所属を解除しますか？" },
};
// 未解決Promiseで通信待ちを固定し、処理中の重複操作が抑止される状態を確認する。
export const Pending: Story = {
  args: { onAction: fn(() => new Promise<void>(() => {})) },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "設定を更新" }));
    await expect(await canvas.findByRole("button", { name: translate("処理中…") })).toBeDisabled();
  },
};
export const FailedAction: Story = {
  args: {
    onAction: fn(async () => {
      throw Object.assign(new Error("private_detail"), { data: { code: "FORBIDDEN" } });
    }),
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "設定を更新" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      translate("この操作を行う権限がありません"),
    );
    await expect(canvas.getByRole("button", { name: "設定を更新" })).toBeEnabled();
  },
};
export const SuccessfulAction: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "設定を更新" }));
    await waitFor(() => expect(props.args.onAction).toHaveBeenCalledTimes(1));
    await expect(canvas.getByRole("button", { name: "設定を更新" })).toBeEnabled();
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};

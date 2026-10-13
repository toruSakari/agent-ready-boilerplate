import { t as translate } from "#client/shared/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { RoleEditor } from "#client/features/manage-access/ui/role-editor";

const meta = {
  title: "Client/Features/ManageAccess/RoleEditor",
  component: RoleEditor,
  args: {
    catalog: { "order:read": "注文閲覧", "order:update": "注文変更", "product.read": "商品閲覧" },
    onSubmit: fn(async () => undefined),
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof RoleEditor>;
export default meta;

type Story = StoryObj<typeof meta>;

export const NewRole: Story = {};
export const ExistingRole: Story = {
  args: { initial: { name: "受注担当", permissions: ["order:read", "order:update"] } },
};
export const EmptyCatalog: Story = { args: { catalog: {} } };
// 現在のカタログから消えた保存済み権限もラベルを表示し、削除後は再追加できない状態を確認する。
export const UnavailableStoredPermission: Story = {
  args: {
    catalog: { "order:read": "注文閲覧" },
    permissionLabels: { "order:read": "注文閲覧", "product.update": "商品管理" },
    initial: { name: "受注担当", permissions: ["order:read", "product.update"] },
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    const unavailable = canvas.getByRole("checkbox", {
      name: translate("商品管理"),
    });
    await expect(unavailable).toBeChecked();
    await userEvent.click(unavailable);
    await expect(unavailable).not.toBeChecked();
    await expect(unavailable).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: translate("ロールを保存") }));
    await expect(await canvas.findByRole("status")).toHaveTextContent(
      translate("ロールを保存しました"),
    );
    await expect(props.args.onSubmit).toHaveBeenCalledWith({
      name: "受注担当",
      permissions: ["order:read"],
    });
  },
};
export const ValidationError: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: translate("ロールを保存") }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      translate("ロール名を入力してください"),
    );
    await expect(props.args.onSubmit).not.toHaveBeenCalled();
  },
};
export const Pending: Story = {
  args: {
    initial: { name: "受注担当", permissions: ["order:read"] },
    onSubmit: fn(() => new Promise<void>(() => {})),
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: translate("ロールを保存") }));
    await expect(await canvas.findByRole("button", { name: translate("保存中…") })).toBeDisabled();
    await expect(canvas.getByLabelText(translate("ロール名"))).toBeDisabled();
  },
};
export const ServerError: Story = {
  args: {
    initial: { name: "受注担当", permissions: ["order:read"] },
    onSubmit: fn(async () => {
      throw Object.assign(new Error("private_detail"), { data: { code: "CONFLICT" } });
    }),
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: translate("ロールを保存") }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      translate("データが競合しています。再読み込みしてください"),
    );
    await expect(canvas.getByLabelText(translate("ロール名"))).toHaveValue("受注担当");
  },
};
export const SaveSelectedPermissions: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.type(canvas.getByLabelText(translate("ロール名")), "受注担当");
    await userEvent.click(canvas.getByRole("checkbox", { name: translate("注文閲覧") }));
    await userEvent.click(canvas.getByRole("checkbox", { name: translate("注文変更") }));
    await userEvent.click(canvas.getByRole("button", { name: translate("ロールを保存") }));
    await expect(await canvas.findByRole("status")).toHaveTextContent(
      translate("ロールを保存しました"),
    );
    await expect(props.args.onSubmit).toHaveBeenCalledWith({
      name: "受注担当",
      permissions: ["order:read", "order:update"],
    });
  },
};

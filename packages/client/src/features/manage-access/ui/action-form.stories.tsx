import { t as translate } from "#client/shared/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ACCESS_FORM_LIMITS } from "#client/features/manage-access/model/form-policy";
import { ActionForm } from "#client/features/manage-access/ui/action-form";
import type { AccessField } from "#client/features/manage-access/ui/action-form";

const fields = [
  { name: "name", label: "表示名", maxLength: ACCESS_FORM_LIMITS.nameMaxLength },
  { name: "email", label: "メールアドレス", type: "email" },
  {
    name: "role",
    label: "ロール",
    options: [
      { value: "viewer", label: "閲覧担当" },
      { value: "editor", label: "編集担当" },
    ],
  },
] satisfies AccessField[];
const meta = {
  title: "Client/Features/ManageAccess/ActionForm",
  component: ActionForm,
  args: { fields, label: "招待を作成", onSubmit: fn(async () => undefined) },
  parameters: { layout: "padded" },
} satisfies Meta<typeof ActionForm>;
export default meta;

type Story = StoryObj<typeof meta>;

// 表示名に前後空白を含め、見た目の入力値とtrim後の送信値の契約を同じ操作で確認する。
async function fillInvitation(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByLabelText(translate("表示名")), " サンプル担当者 ");
  await userEvent.type(canvas.getByLabelText(translate("メールアドレス")), "sample@example.com");
  await userEvent.selectOptions(canvas.getByLabelText(translate("ロール")), "viewer");
  await userEvent.click(canvas.getByRole("button", { name: "招待を作成" }));
}

export const Empty: Story = {};
export const Prefilled: Story = {
  args: {
    fields: fields.map((field) => ({
      ...field,
      initial: { name: "サンプル担当者", email: "sample@example.com" }[field.name] ?? "viewer",
    })),
  },
};
export const ValidationErrors: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.type(canvas.getByLabelText(translate("メールアドレス")), "invalid-address");
    await userEvent.click(canvas.getByRole("button", { name: "招待を作成" }));
    await expect(
      await canvas.findByText(translate("有効なメールアドレスを入力してください")),
    ).toBeVisible();
    await expect(canvas.getByLabelText(translate("メールアドレス"))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(props.args.onSubmit).not.toHaveBeenCalled();
  },
};
export const Pending: Story = {
  args: { onSubmit: fn(() => new Promise<void>(() => {})) },
  play: async (props) => {
    await fillInvitation(props.canvasElement);
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("button", { name: translate("処理中…") })).toBeDisabled();
    await expect(canvas.getByLabelText(translate("メールアドレス"))).toBeDisabled();
  },
};
export const ServerError: Story = {
  args: {
    onSubmit: fn(async () => {
      throw Object.assign(new Error("private_detail"), { data: { code: "CONFLICT" } });
    }),
  },
  play: async (props) => {
    await fillInvitation(props.canvasElement);
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      translate("データが競合しています。再読み込みしてください"),
    );
    await expect(canvas.getByLabelText(translate("メールアドレス"))).toHaveValue(
      "sample@example.com",
    );
  },
};
export const SuccessfulSubmission: Story = {
  play: async (props) => {
    await fillInvitation(props.canvasElement);
    await expect(await within(props.canvasElement).findByRole("status")).toHaveTextContent(
      translate("処理が完了しました"),
    );
    await expect(props.args.onSubmit).toHaveBeenCalledWith({
      name: "サンプル担当者",
      email: "sample@example.com",
      role: "viewer",
    });
  },
};

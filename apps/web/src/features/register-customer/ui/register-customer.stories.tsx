import { t as translate } from "@dev-template/client/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import type { RouterOutputs } from "@dev-template/api-types";
import { RegisterCustomer } from "#web/features/register-customer/ui/register-customer.tsx";

const registration = {
  accountId: "story-customer",
} satisfies RouterOutputs["access"]["registerCustomer"];
const meta = {
  title: "Web/Features/RegisterCustomer",
  component: RegisterCustomer,
  parameters: {
    layout: "padded",
    fixtures: { mode: "web", mutations: { "access.registerCustomer": { data: registration } } },
  },
} satisfies Meta<typeof RegisterCustomer>;
export default meta;

type Story = StoryObj<typeof meta>;

async function register(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByLabelText(translate("表示名")), "サンプル顧客");
  await userEvent.click(canvas.getByRole("button", { name: translate("会員登録する") }));
}

export const Empty: Story = {};
export const RequiredName: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: translate("会員登録する") }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "表示名を正しく入力してください",
    );
  },
};
export const Pending: Story = {
  parameters: { fixtures: { mutations: { "access.registerCustomer": { pending: true } } } },
  play: async (props) => {
    await register(props.canvasElement);
    await expect(
      await within(props.canvasElement).findByRole("button", { name: translate("処理中…") }),
    ).toBeDisabled();
  },
};
export const ServerError: Story = {
  parameters: {
    fixtures: {
      mutations: {
        "access.registerCustomer": {
          error: "登録できませんでした。しばらくしてから再試行してください",
        },
      },
    },
  },
  play: async (props) => {
    await register(props.canvasElement);
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      translate("処理に失敗しました。しばらくしてから再試行してください"),
    );
    await expect(canvas.getByLabelText(translate("表示名"))).toHaveValue("サンプル顧客");
  },
};
export const Registered: Story = {
  play: async (props) => {
    await register(props.canvasElement);
    await expect(await within(props.canvasElement).findByRole("status")).toHaveTextContent(
      translate("処理が完了しました"),
    );
  },
};

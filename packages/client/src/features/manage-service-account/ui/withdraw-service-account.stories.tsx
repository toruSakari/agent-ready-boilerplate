import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, spyOn, userEvent, within } from "storybook/test";
import type { RouterOutputs } from "@dev-template/api-types";
import { WithdrawServiceAccount } from "#client/features/manage-service-account/ui/withdraw-service-account";

const withdrawal = { category: "customer" } satisfies RouterOutputs["access"]["withdraw"];
const meta = {
  title: "Client/Features/ManageServiceAccount/WithdrawServiceAccount",
  component: WithdrawServiceAccount,
  args: { category: "customer", onWithdrawn: fn() },
  parameters: {
    layout: "padded",
    fixtures: { mode: "web", mutations: { "access.withdraw": { data: withdrawal } } },
  },
} satisfies Meta<typeof WithdrawServiceAccount>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Customer: Story = {};
export const Business: Story = {
  args: { category: "business" },
  parameters: {
    fixtures: {
      mode: "business",
      mutations: {
        "access.withdraw": {
          data: { category: "business" } satisfies RouterOutputs["access"]["withdraw"],
        },
      },
    },
  },
};
export const Operator: Story = {
  args: { category: "operator" },
  parameters: {
    fixtures: {
      mode: "admin",
      mutations: {
        "access.withdraw": {
          data: { category: "operator" } satisfies RouterOutputs["access"]["withdraw"],
        },
      },
    },
  },
};
// ブラウザーの確認をキャンセルした場合は、API成功後のコールバックまで進まないことを確かめる。
export const CancelConfirmation: Story = {
  play: async (props) => {
    const confirm = spyOn(window, "confirm").mockReturnValue(false);
    try {
      const canvas = within(props.canvasElement);
      await userEvent.click(canvas.getByRole("button", { name: "通販会員を退会する" }));
      await expect(confirm).toHaveBeenCalledOnce();
      await expect(props.args.onWithdrawn).not.toHaveBeenCalled();
      await expect(canvas.getByRole("button", { name: "通販会員を退会する" })).toBeEnabled();
    } finally {
      confirm.mockRestore();
    }
  },
};

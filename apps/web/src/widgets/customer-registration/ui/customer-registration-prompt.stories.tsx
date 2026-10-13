import { t as translate } from "@dev-template/client/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { CustomerRegistrationPrompt } from "#web/widgets/customer-registration/ui/customer-registration-prompt.tsx";

const meta = {
  title: "Web/Widgets/CustomerRegistrationPrompt",
  component: CustomerRegistrationPrompt,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CustomerRegistrationPrompt>;
export default meta;

type Story = StoryObj<typeof meta>;

export const MissingRegistration: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(
      canvas.getByText(
        translate("会員登録すると、商品を購入できます。企業への所属や招待は必要ありません。"),
      ),
    ).toBeVisible();
    await expect(canvas.getByRole("link", { name: translate("会員登録へ進む") })).toHaveAttribute(
      "href",
      "/register",
    );
  },
};

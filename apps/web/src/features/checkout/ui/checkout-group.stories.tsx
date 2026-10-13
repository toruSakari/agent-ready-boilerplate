import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckoutGroup } from "#web/features/checkout/ui/checkout-group.tsx";

const meta = {
  title: "Web/Store/CheckoutGroup",
  component: CheckoutGroup,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    fixtures: { mode: "web", authentication: "signed-in", organizationId: "", queries: {} },
  },
  args: {
    tenantId: "demo-store",
    lines: [
      {
        tenantId: "demo-store",
        sku: "sample-item",
        name: "毎日に使えるシンプルな商品",
        quantity: 1,
        unitPrice: 2400,
      },
    ],
  },
} satisfies Meta<typeof CheckoutGroup>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sending: Story = {
  parameters: {
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      mutations: { "store.checkout": { pending: true } },
    },
  },
  play: async (props) => {
    const { userEvent, within, expect } = await import("storybook/test");
    const { t } = await import("@dev-template/client/i18n");
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: t("注文を確定する") }));
    await expect(
      await canvas.findByRole("button", { name: t("注文を確定しています…") }),
    ).toBeDisabled();
  },
};
export const PriceChanged: Story = {
  parameters: {
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      mutations: { "store.checkout": { error: "fixture", errorCode: "BAD_REQUEST" } },
    },
  },
  play: async (props) => {
    const { userEvent, within, expect } = await import("storybook/test");
    const { t } = await import("@dev-template/client/i18n");
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: t("注文を確定する") }));
    await expect(await canvas.findByRole("alert")).toBeVisible();
  },
};

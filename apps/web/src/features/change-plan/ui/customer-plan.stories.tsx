import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { CustomerPlan } from "#web/features/change-plan/ui/customer-plan.tsx";
import { t } from "@dev-template/client/i18n";

const data = {
  currentCode: "customer:demo",
  plans: [{ code: "customer:demo", name: "通常会員デモ" }],
};
const meta = {
  title: "Web/Features/Customer Plan",
  component: CustomerPlan,
  parameters: {
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      queries: { "access.customerPlans": { data } },
      mutations: { "access.changeCustomerPlan": { data: undefined } },
    },
  },
} satisfies Meta<typeof CustomerPlan>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Unassigned: Story = {
  parameters: {
    fixtures: { queries: { "access.customerPlans": { data: { ...data, currentCode: null } } } },
  },
};
export const Loading: Story = {
  parameters: { fixtures: { queries: { "access.customerPlans": { pending: true } } } },
};
export const LoadError: Story = {
  parameters: { fixtures: { queries: { "access.customerPlans": { error: "取得失敗" } } } },
};
export const SaveError: Story = {
  parameters: { fixtures: { mutations: { "access.changeCustomerPlan": { error: "内部エラー" } } } },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.selectOptions(
      canvas.getByRole("combobox", { name: t("利用プラン") }),
      "__no_customer_plan__",
    );
    await userEvent.click(canvas.getByRole("button", { name: t("プランを変更") }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      t("処理に失敗しました。しばらくしてから再試行してください"),
    );
    await expect(canvas.getByRole("combobox", { name: t("利用プラン") })).toHaveValue(
      "__no_customer_plan__",
    );
  },
};

import { t as translate } from "#client/shared/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type { ServiceRegistration } from "#client/entities/access";
import { ServiceAccount } from "#client/widgets/service-account";

const registeredCustomer: ServiceRegistration = {
  registered: true,
  category: "customer",
  accountId: "storybook-customer-account",
};
const registeredBusiness: ServiceRegistration = {
  registered: true,
  category: "business",
  accountId: "storybook-business-account",
};
const registeredOperator: ServiceRegistration = {
  registered: true,
  category: "operator",
  accountId: "storybook-operator-account",
};
const missingCustomer: ServiceRegistration = {
  registered: false,
  category: "customer",
  accountId: null,
};
const missingBusiness: ServiceRegistration = {
  registered: false,
  category: "business",
  accountId: null,
};

// 登録確認だけを供給する。未登録・退会画面が業務セッションに依存するようになればfixture不足で検出する。
function fixtures(registration: ServiceRegistration = registeredCustomer) {
  return {
    mode: ({ operator: "admin", business: "business", customer: "web" } as const)[
      registration.category
    ],
    authentication: "signed-in",
    organizationId: "",
    queries: { "access.registration": { data: registration } },
  };
}

const meta = {
  title: "Client/Widgets/Service Account",
  component: ServiceAccount,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ServiceAccount>;
export default meta;

type Story = StoryObj<typeof meta>;

export const CustomerAccount: Story = {
  parameters: { fixtures: fixtures() },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("button", { name: "通販会員を退会する" })).toBeEnabled();
    await expect(canvas.getByText(translate("過去の注文・監査履歴は保持されます。"))).toBeVisible();
  },
};

export const BusinessAccount: Story = {
  parameters: { fixtures: fixtures(registeredBusiness) },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(
      await canvas.findByRole("button", { name: "事業者サービスを退会する" }),
    ).toBeEnabled();
    await expect(
      canvas.getByText(
        translate("最後のオーナーは退会できません。先に別のオーナーを設定してください。"),
      ),
    ).toBeVisible();
  },
};

export const OperatorAccount: Story = {
  parameters: { fixtures: fixtures(registeredOperator) },
};

export const MissingCustomerRegistration: Story = {
  parameters: { fixtures: fixtures(missingCustomer) },
};

export const MissingBusinessRegistration: Story = {
  parameters: { fixtures: fixtures(missingBusiness) },
};

export const SignedOut: Story = {
  parameters: { fixtures: { mode: "web", authentication: "signed-out", organizationId: "" } },
  play: async (props) => {
    await expect(
      within(props.canvasElement).getByRole("link", {
        name: translate("ログインして登録情報を確認"),
      }),
    ).toBeVisible();
  },
};

export const AuthenticationLoading: Story = {
  parameters: { fixtures: { mode: "web", authentication: "loading", organizationId: "" } },
};

export const LoadingRegistration: Story = {
  parameters: {
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      queries: { "access.registration": { pending: true } },
    },
  },
};

export const RegistrationError: Story = {
  parameters: {
    fixtures: {
      mode: "web",
      authentication: "signed-in",
      organizationId: "",
      queries: { "access.registration": { error: "サーバーに接続できませんでした。" } },
    },
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      translate("通信状況を確認して、もう一度お試しください。"),
    );
    await expect(canvas.getByRole("button", { name: translate("もう一度確認") })).toBeEnabled();
  },
};

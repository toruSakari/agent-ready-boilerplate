import { t as translate } from "@dev-template/client/i18n";
import type { RouterOutputs } from "@dev-template/api-types";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import type { ServiceRegistration } from "@dev-template/client/entities/access";
import { CustomerRegistration } from "#web/widgets/customer-registration/index.ts";

const registeredCustomer: ServiceRegistration = {
  registered: true,
  category: "customer",
  accountId: "storybook-customer-account",
};
const missingCustomer: ServiceRegistration = {
  registered: false,
  category: "customer",
  accountId: null,
};

// 所属企業や業務セッションを用意せず、本人の登録状態だけで公開入口が表示できる状態を再現する。
function fixtures(registration: ServiceRegistration = registeredCustomer) {
  return {
    mode: "web",
    authentication: "signed-in",
    organizationId: "",
    queries: { "access.registration": { data: registration } },
  };
}

const meta = {
  title: "Web/Widgets/CustomerRegistration",
  component: CustomerRegistration,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CustomerRegistration>;
export default meta;

type Story = StoryObj<typeof meta>;

export const NewCustomer: Story = {
  parameters: { fixtures: fixtures(missingCustomer) },
  play: async (props) => {
    await expect(
      await within(props.canvasElement).findByRole("textbox", { name: translate("表示名") }),
    ).toBeVisible();
  },
};

export const CustomerAlreadyRegistered: Story = {
  parameters: { fixtures: fixtures() },
  play: async (props) => {
    await expect(
      await within(props.canvasElement).findByText(translate("会員登録済みです。")),
    ).toBeVisible();
  },
};

export const CustomerRegistrationSignedOut: Story = {
  parameters: { fixtures: { mode: "web", authentication: "signed-out", organizationId: "" } },
  play: async (props) => {
    await expect(
      within(props.canvasElement).getByRole("link", {
        name: translate("ログインして会員登録へ進む"),
      }),
    ).toHaveAttribute("href", "/sign-in?returnTo=%2Fregister");
  },
};

export const AuthenticationLoading: Story = {
  parameters: { fixtures: { mode: "web", authentication: "loading", organizationId: "" } },
  play: async (props) => {
    await expect(within(props.canvasElement).getByRole("status")).toHaveTextContent(
      translate("認証情報を確認しています…"),
    );
  },
};

export const LoadingRegistration: Story = {
  parameters: {
    fixtures: {
      ...fixtures(),
      queries: { "access.registration": { pending: true } },
    },
  },
  play: async (props) => {
    await expect(within(props.canvasElement).getByRole("status")).toHaveTextContent(
      translate("登録状況を確認しています…"),
    );
  },
};

export const RegistrationQueryError: Story = {
  parameters: {
    fixtures: {
      ...fixtures(),
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

export const CustomerRegistrationError: Story = {
  parameters: {
    fixtures: {
      ...fixtures(missingCustomer),
      mutations: {
        "access.registerCustomer": {
          error: "private_detail",
          errorCode: "FORBIDDEN",
          errorReason: "EMAIL_VERIFICATION_REQUIRED",
        },
      },
    },
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.type(
      await canvas.findByRole("textbox", { name: translate("表示名") }),
      "サンプル利用者",
    );
    await userEvent.click(canvas.getByRole("button", { name: translate("会員登録する") }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      translate("確認済みのメールアドレスが必要です"),
    );
    await expect(canvas.getByRole("textbox", { name: translate("表示名") })).toHaveValue(
      "サンプル利用者",
    );
  },
};

export const CustomerRegistrationSaved: Story = {
  parameters: {
    fixtures: {
      ...fixtures(missingCustomer),
      mutations: {
        "access.registerCustomer": {
          data: {
            accountId: "storybook-new-customer",
          } satisfies RouterOutputs["access"]["registerCustomer"],
        },
      },
    },
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.type(
      await canvas.findByRole("textbox", { name: translate("表示名") }),
      "サンプル利用者",
    );
    await userEvent.click(canvas.getByRole("button", { name: translate("会員登録する") }));
    await expect(await canvas.findByText(translate("会員登録済みです。"))).toBeVisible();
    await expect(canvas.getByRole("link", { name: translate("商品一覧へ") })).toBeVisible();
  },
};

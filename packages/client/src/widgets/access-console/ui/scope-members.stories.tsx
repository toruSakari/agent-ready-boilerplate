import { t as translate } from "#client/shared/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type { AccessMember, AccessSession } from "#client/entities/access";
import { ScopeMembers } from "#client/widgets/access-console/ui/scope-members";
import { organizationId, session, roles, memberFixtures } from "#storybook/fixtures";

const meta = {
  title: "Client/Widgets/Scope Members",
  component: ScopeMembers,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ScopeMembers>;
export default meta;

type Story = StoryObj<typeof ScopeMembers>;

export const ManageScopeMembers: Story = {
  parameters: { fixtures: memberFixtures() },
  render: () => <ScopeMembers scope={organizationId} />,
};

export const RoleCatalogLoading: Story = {
  parameters: {
    fixtures: {
      ...memberFixtures(),
      queries: {
        ...memberFixtures().queries,
        "access.rolePermissionCatalog": { pending: true },
      },
    },
  },
  render: () => <ScopeMembers scope={organizationId} />,
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("status")).toHaveTextContent(
      "許可する操作を確認しています",
    );
    await expect(canvas.queryByLabelText(translate("ロール名"))).not.toBeInTheDocument();
  },
};

export const RoleCatalogError: Story = {
  parameters: {
    fixtures: {
      ...memberFixtures(),
      queries: {
        ...memberFixtures().queries,
        "access.rolePermissionCatalog": { error: "プランの権限を取得できませんでした。" },
      },
    },
  },
  render: () => <ScopeMembers scope={organizationId} />,
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      translate("通信状況を確認して、もう一度お試しください。"),
    );
    await expect(canvas.queryByLabelText(translate("ロール名"))).not.toBeInTheDocument();
  },
};

export const ReadOnlyMembers: Story = {
  parameters: { fixtures: memberFixtures({ ...session, permissions: ["member.read"] }) },
  render: () => <ScopeMembers scope={organizationId} />,
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("heading", { name: "サンプル管理者" })).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: translate("権限を変更") }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("heading", { name: translate("ユーザーを招待") }),
    ).not.toBeInTheDocument();
  },
};

export const MemberAccessDenied: Story = {
  parameters: { fixtures: memberFixtures({ ...session, permissions: [] }) },
  render: () => <ScopeMembers scope={organizationId} />,
};

export const EmptyMembers: Story = {
  parameters: {
    fixtures: {
      ...memberFixtures({ ...session, permissions: ["member.read"] }),
      queries: {
        "access.session": {
          data: { ...session, permissions: ["member.read"] } satisfies AccessSession,
        },
        "access.members": { data: [] satisfies AccessMember[] },
        "access.roles": { data: roles },
        "access.audit": { error: "権限がありません。", errorCode: "FORBIDDEN" },
      },
    },
  },
  render: () => <ScopeMembers scope={organizationId} />,
};

export const MemberError: Story = {
  parameters: {
    fixtures: {
      mode: "business",
      organizationId,
      queries: {
        "access.session": {
          data: { ...session, permissions: ["member.read"] } satisfies AccessSession,
        },
        "access.members": { error: "メンバーを取得できませんでした。" },
        "access.roles": { data: roles },
        "access.audit": { error: "権限がありません。", errorCode: "FORBIDDEN" },
      },
    },
  },
  render: () => <ScopeMembers scope={organizationId} />,
};

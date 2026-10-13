import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { PermissionDeniedPage } from "#client/widgets/access-console/ui/permission-denied-page";

const meta = {
  title: "Client/Widgets/Permission Denied Page",
  component: PermissionDeniedPage,
  args: {},
  parameters: { fixtures: { mode: "admin", organizationId: "" } },
} satisfies Meta<typeof PermissionDeniedPage>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Denied: Story = {
  play: async (props) => {
    await expect(within(props.canvasElement).getByRole("alert")).toHaveTextContent(
      "このページを閲覧する権限がありません",
    );
  },
};
export const WithNavigation: Story = {
  args: { navigation: <a href="/available">利用できるページ</a> },
  play: async (props) => {
    await expect(
      within(props.canvasElement).getByRole("link", { name: "利用できるページ" }),
    ).toHaveAttribute("href", "/available");
  },
};

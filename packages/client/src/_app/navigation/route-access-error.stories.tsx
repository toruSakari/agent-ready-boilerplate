import type { Meta, StoryObj } from "@storybook/react-vite";
import { RouteAccessError } from "#client/_app/navigation/route-access-error";
import { ROUTE_ACCESS_ERRORS } from "#client/_app/navigation/route-access-guard";

const meta = {
  title: "Client/Access/Route Access Error",
  component: RouteAccessError,
  args: { reset: () => {}, error: new Error(ROUTE_ACCESS_ERRORS.unavailable) },
} satisfies Meta<typeof RouteAccessError>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Unavailable: Story = {};
export const Forbidden: Story = { args: { error: new Error(ROUTE_ACCESS_ERRORS.forbidden) } };

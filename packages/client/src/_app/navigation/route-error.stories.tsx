import type { Meta, StoryObj } from "@storybook/react-vite";
import { RouteError } from "#client/_app/navigation/route-error";

const meta = {
  title: "Client/Navigation/Route Error",
  component: RouteError,
  args: { error: new Error("internal detail"), reset: () => {} },
} satisfies Meta<typeof RouteError>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Unavailable: Story = {};

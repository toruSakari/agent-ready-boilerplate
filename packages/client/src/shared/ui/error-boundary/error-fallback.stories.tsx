import type { Meta, StoryObj } from "@storybook/react-vite";
import { ErrorFallback } from "#client/shared/ui/error-boundary/error-fallback";

const meta = {
  title: "Client/Shared/Error Fallback",
  component: ErrorFallback,
  args: { error: new Error("internal detail"), reset: () => {} },
} satisfies Meta<typeof ErrorFallback>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Unavailable: Story = {};
export const Forbidden: Story = { args: { error: new Error("route_access_forbidden") } };

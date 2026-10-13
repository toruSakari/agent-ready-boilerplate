import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataErrorFallback } from "#client/shared/ui/error-boundary/data-error-fallback";

const meta = {
  title: "Client/Shared/Data Error Fallback",
  component: DataErrorFallback,
  args: { error: new Error("internal detail"), reset: () => {} },
} satisfies Meta<typeof DataErrorFallback>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Unavailable: Story = {};

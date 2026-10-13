import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataErrorBoundary } from "#client/shared/ui/error-boundary/data-error-boundary";

const meta = {
  title: "Client/Shared/DataErrorBoundary",
  component: DataErrorBoundary,
  args: { children: <p>正常な領域は表示を続けます。</p> },
} satisfies Meta<typeof DataErrorBoundary>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Healthy: Story = {};

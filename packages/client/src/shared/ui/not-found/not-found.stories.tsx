import type { Meta, StoryObj } from "@storybook/react-vite";
import { NotFound } from "#client/shared/ui/not-found/not-found";

const meta = { title: "Client/Shared/Not Found", component: NotFound } satisfies Meta<
  typeof NotFound
>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

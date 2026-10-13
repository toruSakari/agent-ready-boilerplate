import type { Meta, StoryObj } from "@storybook/react-vite";
import { BusinessNextAction } from "#business/widgets/business-home/ui/business-next-action.tsx";

const meta = {
  title: "Business/Components/BusinessNextAction",
  component: BusinessNextAction,
  args: { draftCount: 2, organizationId: "story-business" },
  parameters: { fixtures: { mode: "business", organizationId: "story-business", image: "ready" } },
} satisfies Meta<typeof BusinessNextAction>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoDrafts: Story = { args: { draftCount: 0 } };

import type { Meta, StoryObj } from "@storybook/react-vite";
import { BusinessHeader } from "#business/widgets/business-shell/ui/business-header.tsx";

const meta = {
  title: "Business/Components/BusinessHeader",
  component: BusinessHeader,
  args: {},
  parameters: { fixtures: { mode: "business", organizationId: "story-business", image: "ready" } },
} satisfies Meta<typeof BusinessHeader>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

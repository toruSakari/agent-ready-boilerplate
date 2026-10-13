import type { Meta, StoryObj } from "@storybook/react-vite";
import { StorefrontHero } from "#web/widgets/storefront/ui/storefront-hero.tsx";

const meta = {
  title: "Web/Refined/StorefrontHero",
  component: StorefrontHero,
  tags: ["autodocs"],
  parameters: {
    fixtures: { mode: "business", authentication: "signed-in", organizationId: "demo-store" },
  },
  args: {},
} satisfies Meta<typeof StorefrontHero>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

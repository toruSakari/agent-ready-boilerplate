import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ProductImageUpload } from "#business/features/manage-product-image/ui/product-image-upload.tsx";

const meta = {
  title: "Business/Components/ProductImageUpload",
  component: ProductImageUpload,
  args: {
    id: "story-upload",
    name: "藍色のマグカップ",
    pending: false,
    error: false,
    errorId: "story-error",
    onChange: fn(async () => undefined),
  },
  parameters: { fixtures: { mode: "business", organizationId: "story-business", image: "ready" } },
} satisfies Meta<typeof ProductImageUpload>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Pending: Story = { args: { pending: true } };
export const Append: Story = { args: { append: true } };

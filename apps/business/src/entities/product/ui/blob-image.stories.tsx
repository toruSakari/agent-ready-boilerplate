import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { BlobImage } from "#business/entities/product/ui/blob-image.tsx";

// 外部画像を取得せず、Blob URLの生成・解放は実コンポーネントが担当する。
const blob = new Blob(
  [
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#2563eb"/></svg>',
  ],
  { type: "image/svg+xml" },
);
const meta = {
  title: "Business/Entities/Blob Image",
  component: BlobImage,
  args: { blob, alt: "サンプル商品の画像" },
  decorators: [
    (Story) => (
      <div className="h-48 w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BlobImage>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async (props) => {
    await expect(
      within(props.canvasElement).getByRole("img", { name: "サンプル商品の画像" }),
    ).toHaveAttribute("src", expect.stringMatching(/^blob:/));
  },
};

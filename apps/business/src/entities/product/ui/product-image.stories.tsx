import { t as translate } from "@dev-template/client/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import type { Product, ProductImageEntry } from "#business/entities/product/index.ts";
import { ProductImage } from "#business/entities/product/ui/product-image.tsx";

const product = {
  id: "story-product-001",
  name: "藍色のマグカップ",
  imageKey: "story-mug-main",
} satisfies Pick<Product, "id" | "name" | "imageKey">;
const image = {
  id: "story-image-002",
  key: "story-mug-side",
  createdAt: "2026-01-15T09:00:00.000Z",
} satisfies ProductImageEntry;
const meta = {
  title: "Business/Entities/Product/ProductImage",
  component: ProductImage,
  args: { product },
  parameters: { fixtures: { mode: "business", image: "ready" }, layout: "padded" },
} satisfies Meta<typeof ProductImage>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  play: async (props) => {
    await expect(
      await within(props.canvasElement).findByRole("img", { name: "藍色のマグカップの商品画像" }),
    ).toBeVisible();
  },
};
export const NoImage: Story = {
  args: { product: { ...product, imageKey: null } },
  play: async (props) => {
    await expect(within(props.canvasElement).getByText(translate("画像未登録"))).toBeVisible();
  },
};
export const Loading: Story = { parameters: { fixtures: { image: "pending" } } };
export const Error: Story = {
  parameters: { fixtures: { image: "error" } },
  play: async (props) => {
    await expect(
      await within(props.canvasElement).findByText(translate("画像を取得できませんでした")),
    ).toBeVisible();
  },
};
export const AdditionalImage: Story = { args: { image, alt: "マグカップの持ち手と側面" } };

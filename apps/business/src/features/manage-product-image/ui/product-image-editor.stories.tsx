import { t as translate } from "@dev-template/client/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within, waitFor } from "storybook/test";
import type { ProductImageEntry } from "#business/entities/product/index.ts";
import { PRODUCT_IMAGE_LIMITS } from "#business/entities/product/index.ts";
import { ProductImageEditor } from "#business/features/manage-product-image/ui/product-image-editor.tsx";

const images = [
  { id: "story-image-main", key: "story-mug-main", createdAt: "2026-01-15T09:00:00.000Z" },
  { id: "story-image-side", key: "story-mug-side", createdAt: "2026-01-15T09:01:00.000Z" },
] satisfies ProductImageEntry[];
const productName = "藍色のマグカップ";
const meta = {
  title: "Business/Features/ManageProductImage/ProductImageEditor",
  component: ProductImageEditor,
  args: {
    productId: "story-product-001",
    imageKey: null,
    images: [],
    name: productName,
    onChanged: fn(async () => undefined),
  },
  parameters: {
    layout: "padded",
    fixtures: { mode: "business", image: "ready", imageMutation: {} },
  },
} satisfies Meta<typeof ProductImageEditor>;
export default meta;

type Story = StoryObj<typeof meta>;

function imageFile(name = "mug.png") {
  return new File(["offline-story-image"], name, { type: "image/png" });
}

export const Empty: Story = {};
export const WithGallery: Story = {
  args: { imageKey: images[0].key, images },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(
      await canvas.findByRole("img", { name: `${productName}の商品画像` }),
    ).toBeVisible();
    await expect(
      await canvas.findByRole("img", { name: `${productName}の商品画像 2` }),
    ).toBeVisible();
  },
};
export const InvalidFile: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    // ブラウザのacceptによる絞り込みを通さず、編集部品自身が不正形式を拒否することを確認する。
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(
      canvas.getByLabelText(`${productName}の画像`, { exact: true }),
      new File(["invalid"], "image.gif", { type: "image/gif" }),
    );
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      `${PRODUCT_IMAGE_LIMITS.maxSizeMebibytes}MB以下のPNG・JPEG・WebP画像を選んでください`,
    );
    await expect(canvas.getByLabelText(`${productName}の画像`, { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(props.args.onChanged).not.toHaveBeenCalled();
  },
};
export const PendingUpload: Story = {
  parameters: { fixtures: { imageMutation: { pending: true } } },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.upload(
      canvas.getByLabelText(`${productName}の画像`, { exact: true }),
      imageFile(),
    );
    await expect(await canvas.findByRole("status")).toHaveTextContent(translate("画像を更新中…"));
    await expect(canvas.getByLabelText(`${productName}の画像`, { exact: true })).toBeDisabled();
    await expect(canvas.getByLabelText(`${productName}の画像を追加`)).toBeDisabled();
  },
};
export const UploadError: Story = {
  parameters: {
    fixtures: { imageMutation: { error: "画像の保存に失敗しました。再試行してください" } },
  },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.upload(
      canvas.getByLabelText(`${productName}の画像`, { exact: true }),
      imageFile(),
    );
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      translate("処理に失敗しました。しばらくしてから再試行してください"),
    );
    await expect(canvas.getByLabelText(`${productName}の画像`, { exact: true })).toBeEnabled();
  },
};
export const UploadSuccess: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.upload(
      canvas.getByLabelText(`${productName}の画像`, { exact: true }),
      imageFile(),
    );
    await waitFor(() => expect(props.args.onChanged).toHaveBeenCalledTimes(1));
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await expect(canvas.getByLabelText(`${productName}の画像`, { exact: true })).toHaveValue("");
  },
};
export const AppendMultipleImages: Story = {
  args: { imageKey: images[0].key, images },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.upload(canvas.getByLabelText(`${productName}の画像を追加`), [
      imageFile("side.png"),
      imageFile("base.png"),
    ]);
    await waitFor(() => expect(props.args.onChanged).toHaveBeenCalledTimes(1));
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};

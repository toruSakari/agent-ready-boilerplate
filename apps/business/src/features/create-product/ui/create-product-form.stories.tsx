import { t as translate } from "@dev-template/client/i18n";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within, waitFor } from "storybook/test";
import type { Product } from "#business/entities/product/index.ts";
import { CreateProductForm } from "#business/features/create-product/ui/create-product-form.tsx";

const product = {
  id: "story-created-product",
  tenantId: "story-organization",
  sku: "MUG-001",
  name: "藍色のマグカップ",
  unitPrice: 2400,
  imageKey: null,
  images: [],
  createdAt: "2026-01-15T09:00:00.000Z",
} satisfies Product;
const meta = {
  title: "Business/Features/CreateProduct/CreateProductForm",
  component: CreateProductForm,
  parameters: {
    layout: "padded",
    fixtures: {
      mode: "business",
      queries: { "product.list": { data: [product] } },
      mutations: { "product.create": { data: product } },
    },
  },
} satisfies Meta<typeof CreateProductForm>;
export default meta;

type Story = StoryObj<typeof meta>;

async function enterProduct(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByLabelText("SKU"), product.sku);
  await userEvent.type(canvas.getByLabelText(translate("商品名")), product.name);
  await userEvent.clear(canvas.getByLabelText(translate("価格（円）")));
  await userEvent.type(canvas.getByLabelText(translate("価格（円）")), String(product.unitPrice));
  await userEvent.type(canvas.getByLabelText(translate("初期在庫（個）")), "3");
  await userEvent.click(canvas.getByRole("button", { name: translate("商品を登録") }));
}

export const Empty: Story = {};
export const ValidationErrors: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: translate("商品を登録") }));
    await expect(await canvas.findByText(translate("SKUを入力してください"))).toBeVisible();
    await expect(canvas.getByText(translate("商品名を入力してください"))).toBeVisible();
    await expect(canvas.getByLabelText("SKU")).toHaveAttribute("aria-invalid", "true");
  },
};
export const Pending: Story = {
  parameters: { fixtures: { mutations: { "product.create": { pending: true } } } },
  play: async (props) => {
    await enterProduct(props.canvasElement);
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("button", { name: translate("登録中…") })).toBeDisabled();
    await expect(canvas.getByLabelText("SKU")).toBeDisabled();
  },
};
export const ServerError: Story = {
  parameters: {
    fixtures: {
      mutations: { "product.create": { error: "private_detail", errorCode: "CONFLICT" } },
    },
  },
  play: async (props) => {
    await enterProduct(props.canvasElement);
    const canvas = within(props.canvasElement);
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      translate("データが競合しています。再読み込みしてください"),
    );
    await expect(canvas.getByLabelText("SKU")).toHaveValue(product.sku);
    await expect(canvas.getByLabelText(translate("商品名"))).toHaveValue(product.name);
  },
};
export const SuccessfulRegistration: Story = {
  play: async (props) => {
    await enterProduct(props.canvasElement);
    const canvas = within(props.canvasElement);
    await waitFor(() => expect(canvas.getByLabelText("SKU")).toHaveValue(""));
    await expect(canvas.getByLabelText(translate("商品名"))).toHaveValue("");
    await expect(canvas.getByLabelText(translate("価格（円）"))).toHaveValue(product.unitPrice);
  },
};

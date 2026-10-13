import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { MissingServiceRegistration } from "#client/entities/access/ui/missing-service-registration";

const meta = {
  title: "Client/Entities/Access/MissingServiceRegistration",
  component: MissingServiceRegistration,
  args: { category: "customer" },
  parameters: { layout: "padded" },
} satisfies Meta<typeof MissingServiceRegistration>;
export default meta;

type Story = StoryObj<typeof meta>;

// 共有表示は顧客登録先のリンクを自動で決めない。案内は所有アプリから渡す契約を保つ。
export const Customer: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(canvas.getByRole("heading")).toHaveTextContent("会員登録が必要です");
    await expect(canvas.queryByRole("link")).not.toBeInTheDocument();
  },
};
export const Business: Story = {
  args: { category: "business" },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(canvas.getByText(/企業の担当者/)).toBeVisible();
    await expect(canvas.queryByRole("link")).not.toBeInTheDocument();
  },
};
export const Operator: Story = { args: { category: "operator" } };

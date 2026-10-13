import { Alert, AlertDescription, AlertTitle } from "@dev-template/ui/alert";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlertCircle, Info } from "lucide-react";

const meta = {
  title: "UI/Alert",
  component: Alert,
  tags: ["autodocs"],
  args: { variant: "default" },
  argTypes: { variant: { control: "select", options: ["default", "destructive"] } },
  decorators: [
    (Story) => (
      <div className="w-full max-w-lg">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Alert {...args}>
      <Info className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>お知らせ</AlertTitle>
      <AlertDescription>変更内容を確認してから保存してください。</AlertDescription>
    </Alert>
  ),
} satisfies Meta<typeof Alert>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Destructive: Story = {
  args: { variant: "destructive" },
  render: (args) => (
    <Alert {...args}>
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>保存できませんでした</AlertTitle>
      <AlertDescription>
        入力内容は保持されています。時間をおいて再試行してください。
      </AlertDescription>
    </Alert>
  ),
};

// アイコンなしでは本文の左余白が増えない組み合わせも確認する。
export const DescriptionOnly: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertDescription>この操作には管理者の権限が必要です。</AlertDescription>
    </Alert>
  ),
};

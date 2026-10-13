import { Button } from "@dev-template/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@dev-template/ui/card";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
  args: { className: "w-full max-w-sm" },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>プロフィール</CardTitle>
        <CardDescription>表示名と連絡先を確認できます。</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">サンプルユーザー</p>
      </CardContent>
      <CardFooter>
        <Button type="button">編集する</Button>
      </CardFooter>
    </Card>
  ),
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// Headerを省くとContentの上余白も省かれるため、単独利用では呼び出し側で補う。
export const ContentOnly: Story = {
  render: (args) => (
    <Card {...args}>
      <CardContent className="pt-6">
        <p className="text-sm">見出しや操作が不要な情報もまとめられます。</p>
      </CardContent>
    </Card>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>保存した項目</CardTitle>
        <CardDescription>あとで確認する項目をまとめます。</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">まだ保存した項目はありません。</p>
      </CardContent>
      <CardFooter>
        <Button type="button" variant="outline">
          項目を追加する
        </Button>
      </CardFooter>
    </Card>
  ),
};

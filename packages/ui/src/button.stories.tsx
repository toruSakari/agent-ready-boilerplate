import { Button } from "@dev-template/ui/button";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";

const meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "保存する", type: "button", onClick: fn() },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: { control: "select", options: ["default", "sm", "lg", "icon"] },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async (props) => {
    await userEvent.click(within(props.canvasElement).getByRole("button", { name: "保存する" }));
    await expect(props.args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args}>標準</Button>
      <Button {...args} variant="secondary">
        補助
      </Button>
      <Button {...args} variant="outline">
        枠線
      </Button>
      <Button {...args} variant="ghost">
        ゴースト
      </Button>
      <Button {...args} variant="link">
        リンク
      </Button>
      <Button {...args} variant="destructive">
        削除
      </Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="sm">
        小さい
      </Button>
      <Button {...args} size="default">
        標準
      </Button>
      <Button {...args} size="lg">
        大きい
      </Button>
      <Button {...args} size="icon" aria-label="追加">
        <Plus aria-hidden="true" />
      </Button>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, children: "保存中…" },
  play: async (props) => {
    await expect(
      within(props.canvasElement).getByRole("button", { name: "保存中…" }),
    ).toBeDisabled();
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus aria-hidden="true" />
        追加する
      </>
    ),
  },
};

// asChild利用時にもリンクの意味を保ち、装飾用buttonを内側へ追加しない組み合わせを示す。
export const AsLink: Story = {
  render: (args) => (
    <div className="space-y-4">
      <Button {...args} asChild>
        <a href="#button-story-details">詳細を見る</a>
      </Button>
      <p id="button-story-details" className="text-sm text-muted-foreground">
        リンクとして表示するボタンです。
      </p>
    </div>
  ),
};

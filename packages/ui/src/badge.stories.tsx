import { Badge } from "@dev-template/ui/badge";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: { children: "公開中", variant: "default" },
  argTypes: {
    variant: { control: "select", options: ["default", "secondary", "destructive", "outline"] },
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: "secondary", children: "下書き" } };
export const Destructive: Story = { args: { variant: "destructive", children: "エラー" } };
export const Outline: Story = { args: { variant: "outline", children: "未設定" } };

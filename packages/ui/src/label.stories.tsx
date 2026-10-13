import { Checkbox } from "@dev-template/ui/checkbox";
import { Input } from "@dev-template/ui/input";
import { Label } from "@dev-template/ui/label";
import type { Meta, StoryObj } from "@storybook/react-vite";
import userEvent from "@testing-library/user-event";
import { useId } from "react";
import type { ComponentProps } from "react";
import { expect, within } from "storybook/test";

function LabelExample(args: ComponentProps<typeof Label>) {
  const id = useId();
  return (
    <div className="w-full max-w-sm space-y-2">
      <Label {...args} htmlFor={id} />
      <Input id={id} placeholder="サンプルユーザー" />
    </div>
  );
}

function DisabledLabelExample(args: ComponentProps<typeof Label>) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} disabled />
      <Label {...args} htmlFor={id}>
        通知を受け取る
      </Label>
    </div>
  );
}

const meta = {
  title: "UI/Label",
  component: Label,
  tags: ["autodocs"],
  args: { children: "表示名" },
  render: (args) => <LabelExample {...args} />,
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    // Storybook同梱のclickが複製するwindow-proxyのPointerEventをjsdom 30が拒否するため、
    // 上流のuser-eventでラベルから入力への実際のフォーカス移動を検証する。
    const user = userEvent.setup({ document: props.canvasElement.ownerDocument });
    await user.click(canvas.getByText("表示名"));
    await expect(canvas.getByRole("textbox", { name: "表示名" })).toHaveFocus();
  },
};
export const Required: Story = {
  args: {
    children: (
      <>
        表示名 <span className="text-destructive">（必須）</span>
      </>
    ),
  },
};
export const DisabledPeer: Story = { render: (args) => <DisabledLabelExample {...args} /> };

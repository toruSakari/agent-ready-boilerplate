import { Checkbox } from "@dev-template/ui/checkbox";
import { Label } from "@dev-template/ui/label";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useId } from "react";
import type { ComponentProps } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

// 複数storyを同じページへ表示してもラベルが他の入力を指さないよう、例ごとにIDを発行する。
function CheckboxExample(args: ComponentProps<typeof Checkbox>) {
  const id = useId();
  const invalid = args["aria-invalid"] === true;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox {...args} id={id} aria-describedby={invalid ? `${id}-error` : undefined} />
        <Label htmlFor={id}>通知を受け取る</Label>
      </div>
      {invalid && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          通知の設定を確認してください。
        </p>
      )}
    </div>
  );
}

const meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  args: { onCheckedChange: fn() },
  render: (args) => <CheckboxExample {...args} />,
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {
  play: async (props) => {
    const checkbox = within(props.canvasElement).getByRole("checkbox", { name: "通知を受け取る" });
    await expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
    await expect(props.args.onCheckedChange).toHaveBeenLastCalledWith(true);
    await userEvent.keyboard(" ");
    await expect(checkbox).not.toBeChecked();
    await expect(props.args.onCheckedChange).toHaveBeenLastCalledWith(false);
  },
};

export const Checked: Story = { args: { defaultChecked: true } };
export const Indeterminate: Story = { args: { checked: "indeterminate" } };
export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true },
  play: async (props) => {
    await expect(within(props.canvasElement).getByRole("checkbox")).toBeDisabled();
  },
};
export const Invalid: Story = { args: { "aria-invalid": true, className: "border-destructive" } };

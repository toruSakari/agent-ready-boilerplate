import { Input } from "@dev-template/ui/input";
import { Label } from "@dev-template/ui/label";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useId } from "react";
import type { ComponentProps } from "react";
import { expect, userEvent, within } from "storybook/test";

// Formを使わない単体例なので、ラベルと項目エラーのID関連付けをこの例が所有する。
function InputExample(args: ComponentProps<typeof Input>) {
  const id = useId();
  const invalid = args["aria-invalid"] === true;
  return (
    <div className="w-full max-w-sm space-y-2">
      <Label htmlFor={id}>メールアドレス</Label>
      <Input {...args} id={id} aria-describedby={invalid ? `${id}-error` : undefined} />
      {invalid && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          メールアドレスの形式を確認してください。
        </p>
      )}
    </div>
  );
}

const meta = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  args: { type: "email", placeholder: "name@example.com", autoComplete: "off" },
  render: (args) => <InputExample {...args} />,
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async (props) => {
    const input = within(props.canvasElement).getByRole("textbox", { name: "メールアドレス" });
    await userEvent.type(input, "sample@example.com");
    await expect(input).toHaveValue("sample@example.com");
  },
};
export const Filled: Story = { args: { defaultValue: "sample@example.com" } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "sample@example.com" } };
export const ReadOnly: Story = { args: { readOnly: true, defaultValue: "sample@example.com" } };
export const Invalid: Story = {
  args: { "aria-invalid": true, defaultValue: "invalid-address", className: "border-destructive" },
};

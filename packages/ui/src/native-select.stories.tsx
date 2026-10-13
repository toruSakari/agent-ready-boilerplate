import { Label } from "@dev-template/ui/label";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@dev-template/ui/native-select";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useId } from "react";
import type { ComponentProps } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

// ネイティブの選択・無効なoption・ラベル関連付けを、装飾ラッパー込みで確認する。
function SelectExample(args: ComponentProps<typeof NativeSelect>) {
  const id = useId();
  const invalid = args["aria-invalid"] === true;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>表示件数</Label>
      <NativeSelect {...args} id={id} aria-describedby={invalid ? `${id}-error` : undefined}>
        {args.children ?? (
          <>
            <NativeSelectOption value="">選択してください</NativeSelectOption>
            <NativeSelectOption value="10">10件</NativeSelectOption>
            <NativeSelectOption value="25">25件</NativeSelectOption>
            <NativeSelectOption value="50" disabled>
              50件（利用不可）
            </NativeSelectOption>
          </>
        )}
      </NativeSelect>
      {invalid && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          表示件数を選択してください。
        </p>
      )}
    </div>
  );
}

const meta = {
  title: "UI/NativeSelect",
  component: NativeSelect,
  tags: ["autodocs"],
  args: { defaultValue: "", onChange: fn() },
  argTypes: { size: { control: "select", options: ["default", "sm"] } },
  render: (args) => <SelectExample {...args} />,
} satisfies Meta<typeof NativeSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    const select = canvas.getByRole("combobox", { name: "表示件数" });
    await userEvent.selectOptions(select, "25");
    await expect(select).toHaveValue("25");
    await expect(canvas.getByRole("option", { name: "50件（利用不可）" })).toBeDisabled();
    await expect(props.args.onChange).toHaveBeenCalledTimes(1);
  },
};
export const Small: Story = { args: { size: "sm", defaultValue: "10" } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "10" } };
export const Invalid: Story = { args: { "aria-invalid": true } };
export const GroupedOptions: Story = {
  args: {
    children: (
      <>
        <NativeSelectOption value="">選択してください</NativeSelectOption>
        <NativeSelectOptGroup label="少ない件数">
          <NativeSelectOption value="10">10件</NativeSelectOption>
          <NativeSelectOption value="25">25件</NativeSelectOption>
        </NativeSelectOptGroup>
        <NativeSelectOptGroup label="多い件数">
          <NativeSelectOption value="50">50件</NativeSelectOption>
          <NativeSelectOption value="100">100件</NativeSelectOption>
        </NativeSelectOptGroup>
      </>
    ),
  },
};

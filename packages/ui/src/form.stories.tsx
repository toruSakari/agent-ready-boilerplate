import { Button } from "@dev-template/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@dev-template/ui/form";
import { Input } from "@dev-template/ui/input";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { expect, fn, userEvent, within } from "storybook/test";

type ExampleValues = { displayName: string };

type FormExampleProps = { disabled?: boolean; onSubmit: (values: ExampleValues) => void };

function FormExample(props: FormExampleProps) {
  const { disabled = false, onSubmit } = props;

  const form = useForm<ExampleValues>({ defaultValues: { displayName: "" }, disabled });
  const [savedName, setSavedName] = useState<string | null>(null);
  return (
    <Form {...form}>
      <form
        className="w-full max-w-sm space-y-4"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          onSubmit(values);
          setSavedName(values.displayName);
        })}
      >
        <FormField
          control={form.control}
          name="displayName"
          rules={{ validate: (value) => value.trim().length > 0 || "表示名を入力してください" }}
          render={(inputProps) => (
            <FormItem>
              <FormLabel>表示名</FormLabel>
              <FormControl>
                <Input {...inputProps.field} placeholder="サンプルユーザー" autoComplete="off" />
              </FormControl>
              <FormDescription>画面に表示する名前です。</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={disabled}>
          保存する
        </Button>
        {savedName !== null && (
          <p role="status" className="text-sm">
            {savedName} を保存しました。
          </p>
        )}
      </form>
    </Form>
  );
}

const meta = {
  title: "UI/Form",
  component: FormExample,
  tags: ["autodocs"],
  args: { disabled: false, onSubmit: fn() },
  parameters: {
    docs: {
      description: {
        component:
          "FormProvider と FormField を組み合わせた、通信を行わない React Hook Form の例です。",
      },
    },
  },
} satisfies Meta<typeof FormExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// エラー本文だけでなく、入力の説明に補足文とエラーが一緒に関連付けられることを確認する。
export const ValidationError: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "保存する" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("表示名を入力してください");
    await expect(canvas.getByRole("textbox", { name: "表示名" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(canvas.getByRole("textbox", { name: "表示名" })).toHaveAccessibleDescription(
      "画面に表示する名前です。 表示名を入力してください",
    );
    await expect(props.args.onSubmit).not.toHaveBeenCalled();
  },
};

export const SubmitAfterCorrection: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    const submit = canvas.getByRole("button", { name: "保存する" });
    await userEvent.click(submit);
    await expect(await canvas.findByRole("alert")).toBeVisible();
    const input = canvas.getByRole("textbox", { name: "表示名" });
    await userEvent.type(input, "サンプルユーザー");
    await userEvent.click(submit);
    await expect(await canvas.findByRole("status")).toHaveTextContent(
      "サンプルユーザー を保存しました。",
    );
    await expect(input).toHaveAttribute("aria-invalid", "false");
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await expect(props.args.onSubmit).toHaveBeenCalledTimes(1);
    await expect(props.args.onSubmit).toHaveBeenCalledWith({
      displayName: "サンプルユーザー",
    });
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async (props) => {
    const canvas = within(props.canvasElement);
    await expect(canvas.getByRole("textbox", { name: "表示名" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "保存する" })).toBeDisabled();
  },
};

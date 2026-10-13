import { Button } from "@dev-template/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@dev-template/ui/dropdown-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { ComponentProps } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

function ActionMenu(args: ComponentProps<typeof DropdownMenu>) {
  const [selected, setSelected] = useState("未選択");
  return (
    <div className="space-y-4">
      <DropdownMenu {...args}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline">
            操作を開く
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>アカウント</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => setSelected("プロフィール")}>
              プロフィール<DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>請求情報（権限なし）</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>表示</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => setSelected("一覧表示")}>
                    一覧表示
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setSelected("カード表示")}>
                    カード表示
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSelected("ヘルプ")}>ヘルプ</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <p role="status" className="text-sm text-muted-foreground">
        選択した操作: {selected}
      </p>
    </div>
  );
}

// チェック操作後も開いたままにする例と、通常の選択で閉じる例を分けてRadixの契約を示す。
function SettingsMenu(args: ComponentProps<typeof DropdownMenu>) {
  const [showHints, setShowHints] = useState(true);
  const [density, setDensity] = useState("comfortable");
  return (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          表示設定
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>表示オプション</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={showHints}
          onCheckedChange={(checked) => setShowHints(checked === true)}
          onSelect={(event) => event.preventDefault()}
        >
          ヒントを表示
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>表示密度</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={density} onValueChange={setDensity}>
          <DropdownMenuRadioItem value="comfortable">標準</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="compact">コンパクト</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const meta = {
  title: "UI/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs"],
  args: { onOpenChange: fn() },
  render: (args) => <ActionMenu {...args} />,
} satisfies Meta<typeof DropdownMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

// Portalへ描画される項目はcanvas外にあるため、同じdocumentのbodyから検索する。
export const Default: Story = {
  play: async (props) => {
    const canvas = within(props.canvasElement);
    const body = within(props.canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "操作を開く" }));
    const menu = within(await body.findByRole("menu"));
    await expect(menu.getByRole("menuitem", { name: "請求情報（権限なし）" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(props.args.onOpenChange).toHaveBeenLastCalledWith(true);
    await userEvent.click(menu.getByRole("menuitem", { name: /プロフィール/ }));
    await expect(canvas.getByRole("status")).toHaveTextContent("選択した操作: プロフィール");
    await expect(props.args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const CheckboxAndRadioItems: Story = {
  render: (args) => <SettingsMenu {...args} />,
  play: async (props) => {
    const trigger = within(props.canvasElement).getByRole("button", { name: "表示設定" });
    const body = within(props.canvasElement.ownerDocument.body);
    await userEvent.click(trigger);
    const menu = within(await body.findByRole("menu"));
    const hints = menu.getByRole("menuitemcheckbox", { name: "ヒントを表示" });
    await expect(hints).toBeChecked();
    await userEvent.click(hints);
    await expect(hints).not.toBeChecked();
    await userEvent.click(menu.getByRole("menuitemradio", { name: "コンパクト" }));
    await userEvent.click(trigger);
    await expect(
      within(await body.findByRole("menu")).getByRole("menuitemradio", { name: "コンパクト" }),
    ).toBeChecked();
    await userEvent.keyboard("{Escape}");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  },
};

export const Disabled: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" disabled>
          操作を開く
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>プロフィール</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async (props) => {
    await expect(
      within(props.canvasElement).getByRole("button", { name: "操作を開く" }),
    ).toBeDisabled();
  },
};

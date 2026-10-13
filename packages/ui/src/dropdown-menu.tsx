"use client";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

// 開閉・フォーカス移動・項目のARIAはRadixに委ね、ここでは共通スタイルと公開部品を揃える。
export const DropdownMenu = DropdownMenuPrimitive.Root;

export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export const DropdownMenuGroup = DropdownMenuPrimitive.Group;

export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

export const DropdownMenuSub = DropdownMenuPrimitive.Sub;

export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export { DropdownMenuSubTrigger } from "@dev-template/ui/dropdown-menu-sub-trigger";
export { DropdownMenuSubContent } from "@dev-template/ui/dropdown-menu-sub-content";
export { DropdownMenuContent } from "@dev-template/ui/dropdown-menu-content";
export { DropdownMenuItem } from "@dev-template/ui/dropdown-menu-item";
export { DropdownMenuCheckboxItem } from "@dev-template/ui/dropdown-menu-checkbox-item";
export { DropdownMenuRadioItem } from "@dev-template/ui/dropdown-menu-radio-item";
export { DropdownMenuLabel } from "@dev-template/ui/dropdown-menu-label";
export { DropdownMenuSeparator } from "@dev-template/ui/dropdown-menu-separator";
export { DropdownMenuShortcut } from "@dev-template/ui/dropdown-menu-shortcut";

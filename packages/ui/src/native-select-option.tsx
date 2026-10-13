"use client";
import * as React from "react";
import { cn } from "@dev-template/ui/lib/cn";

// OSの選択肢ポップアップでも文字が読めるよう、optionとoptgroupはシステム色を使う。
export function NativeSelectOption(inputProps: React.ComponentProps<"option">) {
  const { className, ...props } = inputProps;

  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  );
}

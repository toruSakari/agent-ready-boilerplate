"use client";
import * as React from "react";
import { cn } from "@dev-template/ui/lib/cn";

// ショートカット表記の装飾だけを担い、キー入力の処理やショートカット登録は行わない。
export const DropdownMenuShortcut = (inputProps: React.HTMLAttributes<HTMLSpanElement>) => {
  const { className, ...props } = inputProps;

  return (
    <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />
  );
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

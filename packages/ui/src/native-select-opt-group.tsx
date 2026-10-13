"use client";
import * as React from "react";
import { cn } from "@dev-template/ui/lib/cn";

export function NativeSelectOptGroup(inputProps: React.ComponentProps<"optgroup">) {
  const { className, ...props } = inputProps;

  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  );
}

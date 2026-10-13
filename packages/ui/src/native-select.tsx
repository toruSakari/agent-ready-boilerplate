"use client";
import * as React from "react";
import { cn } from "@dev-template/ui/lib/cn";
import { ChevronDownIcon } from "lucide-react";

/** ネイティブselectの選択・キーボード操作を維持する。sizeは表示サイズ用で、HTMLの表示行数ではない。 */
export function NativeSelect(
  inputProps: Omit<React.ComponentProps<"select">, "size"> & { size?: "sm" | "default" },
) {
  const { className, size = "default", ...props } = inputProps;

  return (
    <div
      className="group/native-select relative w-fit has-[select:disabled]:opacity-50"
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        data-size={size}
        className={cn(
          "h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent px-3 py-2 pr-9 text-sm shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed data-[size=sm]:h-8 data-[size=sm]:py-1 dark:bg-input/30 dark:hover:bg-input/50",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          className,
        )}
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground opacity-50 select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

export { NativeSelectOption } from "@dev-template/ui/native-select-option";
export { NativeSelectOptGroup } from "@dev-template/ui/native-select-opt-group";

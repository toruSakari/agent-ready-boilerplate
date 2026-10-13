import * as React from "react";

import { cn } from "@dev-template/ui/lib/cn";

// refとネイティブ入力属性を透過し、フォーム側のフォーカス制御・数値変換・入力制約を妨げない。
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  (inputProps, ref) => {
    const { className, type, ...props } = inputProps;

    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-input bg-background px-3 py-1 text-base transition-colors file:border-0 file:bg-background file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

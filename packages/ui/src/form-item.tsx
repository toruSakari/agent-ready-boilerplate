"use client";
import * as React from "react";
import { cn } from "@dev-template/ui/lib/cn";
import { FormItemContext } from "@dev-template/ui/lib/form-state";

export const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (inputProps, ref) => {
    const { className, ...props } = inputProps;

    // 配列の添字や項目名に依存せず、同名項目やSSRでもラベルとの関連付けが衝突しないIDを使う。
    const id = React.useId();

    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn("space-y-2", className)} {...props} />
      </FormItemContext.Provider>
    );
  },
);
FormItem.displayName = "FormItem";

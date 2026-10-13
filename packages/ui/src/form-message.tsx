"use client";
import * as React from "react";
import { cn } from "@dev-template/ui/lib/cn";
import { useFormField } from "@dev-template/ui/lib/form-state";

export const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>((inputProps, ref) => {
  const { className, children, ...props } = inputProps;

  const { error, formMessageId } = useFormField();
  // 項目エラーを優先し、補足のchildrenが検証メッセージを隠さないようにする。
  const body = error ? String(error?.message ?? "") : children;

  // 空のalertを残さず、入力に関連付いた実際のメッセージだけを読み上げ対象にする。
  if (!body) {
    return null;
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      role="alert"
      className={cn("text-[0.8rem] font-medium text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  );
});
FormMessage.displayName = "FormMessage";

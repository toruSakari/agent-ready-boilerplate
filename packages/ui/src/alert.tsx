"use client";
import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@dev-template/ui/lib/cn";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

// 通信・操作の失敗を支援技術へ通知できるようroleを共通化し、業務エラーの内容は呼び出し元から受け取る。
export const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>((inputProps, ref) => {
  const { className, variant, ...props } = inputProps;
  return (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  );
});
Alert.displayName = "Alert";

export { AlertTitle } from "@dev-template/ui/alert-title";
export { AlertDescription } from "@dev-template/ui/alert-description";

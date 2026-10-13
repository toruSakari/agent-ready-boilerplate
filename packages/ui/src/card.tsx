"use client";
import * as React from "react";
import { cn } from "@dev-template/ui/lib/cn";

// レイアウトの枠として提供し、見出しの階層・一覧・操作など業務に合うHTMLは利用側で組み立てる。
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (inputProps, ref) => {
    const { className, ...props } = inputProps;
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-3xl border border-border bg-card text-card-foreground shadow-sm",
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

export { CardHeader } from "@dev-template/ui/card-header";
export { CardTitle } from "@dev-template/ui/card-title";
export { CardDescription } from "@dev-template/ui/card-description";
export { CardContent } from "@dev-template/ui/card-content";
export { CardFooter } from "@dev-template/ui/card-footer";

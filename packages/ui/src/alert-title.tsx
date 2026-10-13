"use client";
import * as React from "react";
import { cn } from "@dev-template/ui/lib/cn";

export const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>((inputProps, ref) => {
  const { className, ...props } = inputProps;
  return (
    <h5
      ref={ref}
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  );
});
AlertTitle.displayName = "AlertTitle";

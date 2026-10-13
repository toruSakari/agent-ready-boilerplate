"use client";
import * as React from "react";
import { cn } from "@dev-template/ui/lib/cn";

export const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((inputProps, ref) => {
  const { className, ...props } = inputProps;
  return <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />;
});
CardDescription.displayName = "CardDescription";

"use client";
import * as React from "react";
import { cn } from "@dev-template/ui/lib/cn";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (inputProps, ref) => {
    const { className, ...props } = inputProps;
    return <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />;
  },
);
CardContent.displayName = "CardContent";

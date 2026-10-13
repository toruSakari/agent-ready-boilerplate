"use client";
import * as React from "react";
import { cn } from "@dev-template/ui/lib/cn";

export const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (inputProps, ref) => {
    const { className, ...props } = inputProps;
    return (
      <div
        ref={ref}
        className={cn("font-semibold leading-none tracking-tight", className)}
        {...props}
      />
    );
  },
);
CardTitle.displayName = "CardTitle";

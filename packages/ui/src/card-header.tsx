"use client";
import * as React from "react";
import { cn } from "@dev-template/ui/lib/cn";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (inputProps, ref) => {
    const { className, ...props } = inputProps;
    return <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
  },
);
CardHeader.displayName = "CardHeader";

"use client";
import * as React from "react";
import { cn } from "@dev-template/ui/lib/cn";

export const AlertDialogFooter = (inputProps: React.HTMLAttributes<HTMLDivElement>) => {
  const { className, ...props } = inputProps;
  return (
    <div
      className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
      {...props}
    />
  );
};
AlertDialogFooter.displayName = "AlertDialogFooter";

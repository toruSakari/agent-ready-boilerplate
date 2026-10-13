"use client";
import * as React from "react";
import { cn } from "@dev-template/ui/lib/cn";

export const AlertDialogHeader = (inputProps: React.HTMLAttributes<HTMLDivElement>) => {
  const { className, ...props } = inputProps;
  return (
    <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
  );
};
AlertDialogHeader.displayName = "AlertDialogHeader";

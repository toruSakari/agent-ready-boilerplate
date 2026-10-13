"use client";
import * as React from "react";
import { cn } from "@dev-template/ui/lib/cn";

export const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>((inputProps, ref) => {
  const { className, ...props } = inputProps;
  return <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />;
});
AlertDescription.displayName = "AlertDescription";

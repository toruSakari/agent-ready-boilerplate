"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@dev-template/ui/lib/cn";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

// htmlForとRadixのラベル操作を維持する。フォーム内のID連携は上位のFormLabelが担当する。
const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>((inputProps, ref) => {
  const { className, ...props } = inputProps;
  return <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />;
});
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };

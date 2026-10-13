"use client";
import * as React from "react";
import { cn } from "@dev-template/ui/lib/cn";
import { useFormField } from "@dev-template/ui/lib/form-state";

export const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>((inputProps, ref) => {
  const { className, ...props } = inputProps;

  const { formDescriptionId } = useFormField();

  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-[0.8rem] text-muted-foreground", className)}
      {...props}
    />
  );
});
FormDescription.displayName = "FormDescription";

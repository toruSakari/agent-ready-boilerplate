"use client";
import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@dev-template/ui/lib/cn";
import { buttonVariants } from "@dev-template/ui/button";

export const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>((inputProps, ref) => {
  const { className, ...props } = inputProps;
  return (
    <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
  );
});
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

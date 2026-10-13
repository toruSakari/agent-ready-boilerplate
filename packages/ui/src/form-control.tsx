"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { useFormField } from "@dev-template/ui/lib/form-state";

/** Slotの子へIDとエラー関連のARIAを渡す。各フォームで同じ属性を重複管理しない。 */
export const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>((inputProps, ref) => {
  const { ...props } = inputProps;

  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={!error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`}
      aria-invalid={!!error}
      {...props}
    />
  );
});
FormControl.displayName = "FormControl";

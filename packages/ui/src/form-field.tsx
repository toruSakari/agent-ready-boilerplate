"use client";
import { Controller } from "react-hook-form";
import type { ControllerProps, FieldPath, FieldValues } from "react-hook-form";
import { FormFieldContext } from "@dev-template/ui/lib/form-state";

/** Form内で項目名をControllerと共有する。入力・ラベル・エラーは内側の同じFormItemに組み合わせる。 */
export const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  inputProps: ControllerProps<TFieldValues, TName>,
) => {
  const { ...props } = inputProps;

  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

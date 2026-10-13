import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useSyncExternalStore } from "react";
import { errorMessage } from "#client/shared/i18n";
import { createActionFormSchema } from "#client/features/manage-access/model/action-form";
import type { AccessField } from "#client/features/manage-access/model/action-form";

export function useActionForm(
  fields: AccessField[],
  onSubmit: (values: Record<string, string>) => Promise<void>,
) {
  // SSRでは検証・送信が接続されるまで操作させない。
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const form = useForm({
    resolver: zodResolver(createActionFormSchema(fields)),
    defaultValues: Object.fromEntries(fields.map((field) => [field.name, field.initial ?? ""])),
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit(values: Record<string, string>) {
    setError("");
    setSuccess(false);
    try {
      await onSubmit(
        Object.fromEntries(Object.entries(values).map((props) => [props[0], props[1].trim()])),
      );
      setSuccess(true);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  return { form, hydrated, error, success, submit };
}

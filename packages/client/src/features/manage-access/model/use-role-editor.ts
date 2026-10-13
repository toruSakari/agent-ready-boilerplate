import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { errorMessage } from "#client/shared/i18n";
import {
  roleEditorSchema,
  rolePermissionOptions,
} from "#client/features/manage-access/model/role-editor";
import type { RoleEditorValues } from "#client/features/manage-access/model/role-editor";

export function useRoleEditor(props: {
  catalog: Record<string, string>;
  permissionLabels: Record<string, string>;
  initial?: RoleEditorValues;
  onSubmit: (input: RoleEditorValues) => Promise<void>;
}) {
  const form = useForm({
    resolver: zodResolver(roleEditorSchema),
    defaultValues: props.initial ?? { name: "", permissions: [] },
  });
  const selected = useWatch({ control: form.control, name: "permissions" });
  const options = rolePermissionOptions(
    props.catalog,
    props.permissionLabels,
    props.initial?.permissions ?? [],
    selected,
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit(input: RoleEditorValues) {
    setError("");
    setSuccess(false);
    try {
      await props.onSubmit(input);
      setSuccess(true);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  return { form, options, error, success, submit };
}

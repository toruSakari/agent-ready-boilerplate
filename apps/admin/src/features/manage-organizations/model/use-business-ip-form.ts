import { errorMessage } from "@dev-template/client/i18n";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useTRPC } from "@dev-template/client/api";
import type { RouterOutputs } from "@dev-template/api-types";
import {
  businessIpFormSchema,
  entries,
} from "#admin/features/manage-organizations/model/business-ip-form.ts";

export function useBusinessIpForm(id: string, policy: RouterOutputs["access"]["businessIpPolicy"]) {
  const t = useTRPC();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const form = useForm({
    resolver: zodResolver(businessIpFormSchema),
    defaultValues: { enabled: policy.enabled, allowedIps: policy.allowedIps.join("\n") },
  });
  const mutation = useMutation(
    t.access.updateBusinessIpPolicy.mutationOptions({
      onSuccess: async () => {
        await client.invalidateQueries(t.access.pathFilter());
      },
    }),
  );
  const submit = form.handleSubmit(async (values) => {
    setError("");
    setSaved(false);
    try {
      await mutation.mutateAsync({
        id,
        enabled: values.enabled,
        allowedIps: entries(values.allowedIps),
      });
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  return { form, submit, pending: mutation.isPending, error, saved };
}

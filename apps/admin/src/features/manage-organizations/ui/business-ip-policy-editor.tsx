"use client";
import { t as translate } from "@dev-template/client/i18n";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@dev-template/client/api";
import { BusinessIpPolicyForm } from "#admin/features/manage-organizations/ui/business-ip-policy-form.tsx";

export function BusinessIpPolicyEditor(props: { id: string }) {
  const t = useTRPC();
  const query = useSuspenseQuery(t.access.businessIpPolicy.queryOptions({ id: props.id }));
  if (query.isError) {
    throw query.error;
  }

  return (
    <section className="grid gap-3">
      <h3 className="font-semibold">{translate("企業画面のIP制限")}</h3>
      <BusinessIpPolicyForm key={props.id} id={props.id} policy={query.data} />
    </section>
  );
}

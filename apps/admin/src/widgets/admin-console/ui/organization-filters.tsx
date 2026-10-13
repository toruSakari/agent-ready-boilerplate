import { useSuspenseOptionalQuery, useTRPC, perQueryAccessOptions } from "@dev-template/client/api";
import {
  ListFilters,
  useListSearch,
  organizationListSearchSchema,
} from "@dev-template/client/list-filters";
import { t } from "@dev-template/client/i18n";

export function OrganizationFilters() {
  const search = useListSearch(organizationListSearchSchema);
  const trpc = useTRPC();
  const plans = useSuspenseOptionalQuery(
    trpc.access.organizationPlanOptions.queryOptions(undefined, perQueryAccessOptions),
  );
  return (
    <ListFilters
      key={search.key}
      value={search.value}
      onChange={search.change}
      searchLabel={t("企業名を検索")}
      sort={false}
      options={[
        { value: "", label: "すべて" },
        { value: "active", label: "利用中" },
        { value: "inactive", label: "利用停止" },
      ]}
      planOptions={[
        { value: "unassigned", label: t("未設定") },
        ...(plans.data ?? []).map((plan) => ({ value: plan.code, label: plan.name })),
      ]}
    />
  );
}

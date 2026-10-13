import type { ListSearch } from "#client/widgets/list-filters/model/list-search.ts";

export type FilterSettings = {
  value: ListSearch;
  onChange: (value: ListSearch) => void;
  searchLabel: string;
  options?: { value: string; label: string }[];
  statusKey?: "status" | "stock";
  dates?: boolean;
  prices?: boolean;
  sort?: boolean;
  planOptions?: { value: string; label: string }[];
};

export function filterSettings(props: FilterSettings) {
  return {
    ...props,
    options: props.options ?? [],
    statusKey: props.statusKey ?? "status",
    dates: props.dates ?? false,
    prices: props.prices ?? false,
    sort: props.sort ?? true,
    planOptions: props.planOptions ?? [],
  };
}

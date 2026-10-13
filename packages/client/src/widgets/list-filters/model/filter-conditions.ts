import { t } from "#client/shared/i18n/index.ts";
import type { ListSearch } from "#client/widgets/list-filters/model/list-search.ts";

export function filterConditions(
  value: ListSearch,
  options: { value: string; label: string }[],
  planOptions: { value: string; label: string }[],
) {
  const labels: string[] = [];
  if (value.q) {
    labels.push(t("検索：{{query}}", { query: value.q }));
  }

  const status = options.find((option) => option.value === (value.status ?? value.stock));
  if (status?.value) {
    labels.push(t(status.label));
  }

  const plan = planOptions.find((option) => option.value === value.planCode);
  if (value.planCode) {
    labels.push(plan?.label ?? t("契約プラン：{{plan}}", { plan: value.planCode }));
  }

  labels.push(...rangeConditions(value));
  if (value.sort === "oldest") {
    labels.push(t("古い順"));
  }

  return labels;
}

function rangeConditions(value: ListSearch) {
  const labels: string[] = [];
  if (value.from) {
    labels.push(t("開始日：{{date}}", { date: value.from }));
  }

  if (value.to) {
    labels.push(t("終了日：{{date}}", { date: value.to }));
  }

  if (value.minPrice !== undefined) {
    labels.push(t("最低価格：{{price}}円", { price: value.minPrice }));
  }

  if (value.maxPrice !== undefined) {
    labels.push(t("最高価格：{{price}}円", { price: value.maxPrice }));
  }

  return labels;
}

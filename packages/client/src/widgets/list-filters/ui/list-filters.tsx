import { filterSettings } from "#client/widgets/list-filters/model/filter-settings.ts";
import type { FilterSettings } from "#client/widgets/list-filters/model/filter-settings.ts";
import { useState, useId } from "react";
import { t } from "#client/shared/i18n/index.ts";
import { Button } from "@dev-template/ui/button";
import { Input } from "@dev-template/ui/input";
import { Label } from "@dev-template/ui/label";
import { DateFilterFields } from "#client/widgets/list-filters/ui/date-filter-fields.tsx";
import { PriceFilterFields } from "#client/widgets/list-filters/ui/price-filter-fields.tsx";
import { FilterSelect } from "#client/widgets/list-filters/ui/filter-select.tsx";
import { StatusFilter } from "#client/widgets/list-filters/ui/status-filter.tsx";
import { FilterChips } from "#client/widgets/list-filters/ui/filter-chips.tsx";
import { filterConditions } from "#client/widgets/list-filters/model/filter-conditions.ts";
import { LIST_SEARCH_LIMITS } from "#client/shared/config/input-limits.ts";

export function ListFilters(props: FilterSettings) {
  const { value, onChange, searchLabel, options, statusKey, dates, prices, sort, planOptions } =
    filterSettings(props);
  const id = useId();
  const [draft, setDraft] = useState(value);
  return (
    <section
      className="mb-6 grid min-w-0 gap-4 rounded-xl border bg-card p-4"
      aria-label={t("一覧の絞り込み")}
    >
      {!!options.length && (
        <StatusFilter
          label={t("状態で絞り込み")}
          value={value[statusKey] ?? ""}
          options={options}
          onChange={(status) => onChange({ ...value, [statusKey]: status || undefined })}
        />
      )}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onChange({ ...value, ...draft, q: draft.q || undefined });
        }}
      >
        <div className="grid min-w-0 basis-52 flex-1 gap-2">
          <Label htmlFor={`${id}-search`}>{searchLabel}</Label>
          <Input
            id={`${id}-search`}
            value={draft.q ?? ""}
            maxLength={LIST_SEARCH_LIMITS.textLength}
            onChange={(event) => setDraft({ ...draft, q: event.target.value })}
          />
        </div>
        {dates && <DateFilterFields value={draft} onChange={setDraft} />}
        {prices && <PriceFilterFields value={draft} onChange={setDraft} />}
        {sort && (
          <FilterSelect
            label={t("並び替え")}
            value={draft.sort ?? "newest"}
            options={[
              { value: "newest", label: t("新しい順") },
              { value: "oldest", label: t("古い順") },
            ]}
            onChange={(next) =>
              setDraft({ ...draft, sort: next === "oldest" ? "oldest" : undefined })
            }
          />
        )}
        {!!planOptions.length && (
          <FilterSelect
            label={t("契約プラン")}
            value={draft.planCode ?? ""}
            options={[{ value: "", label: t("すべてのプラン") }, ...planOptions]}
            onChange={(next) => setDraft({ ...draft, planCode: next || undefined })}
          />
        )}
        <Button type="submit" className="w-fit">
          {t("絞り込む")}
        </Button>
      </form>
      <FilterChips
        conditions={filterConditions(value, options, planOptions)}
        clear={() => onChange({})}
      />
    </section>
  );
}

import { useId } from "react";
import { t } from "#client/shared/i18n/index.ts";
import { Input } from "@dev-template/ui/input";
import { Label } from "@dev-template/ui/label";
import type { ListSearch } from "#client/widgets/list-filters/model/list-search.ts";

export function PriceFilterFields(props: {
  value: ListSearch;
  onChange: (value: ListSearch) => void;
}) {
  const id = useId();
  return (
    <>
      <div className="grid w-36 gap-2">
        <Label htmlFor={`${id}-min`}>{t("最低価格（円）")}</Label>
        <Input
          id={`${id}-min`}
          type="number"
          min={0}
          max={props.value.maxPrice ?? Number.MAX_SAFE_INTEGER}
          step={1}
          value={props.value.minPrice ?? ""}
          onChange={(event) =>
            props.onChange({
              ...props.value,
              minPrice: event.target.value === "" ? undefined : event.target.valueAsNumber,
            })
          }
        />
      </div>
      <div className="grid w-36 gap-2">
        <Label htmlFor={`${id}-max`}>{t("最高価格（円）")}</Label>
        <Input
          id={`${id}-max`}
          type="number"
          min={props.value.minPrice ?? 0}
          max={Number.MAX_SAFE_INTEGER}
          step={1}
          value={props.value.maxPrice ?? ""}
          onChange={(event) =>
            props.onChange({
              ...props.value,
              maxPrice: event.target.value === "" ? undefined : event.target.valueAsNumber,
            })
          }
        />
      </div>
    </>
  );
}

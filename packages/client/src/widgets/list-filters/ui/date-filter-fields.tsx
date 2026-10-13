import { useId } from "react";
import { t } from "#client/shared/i18n/index.ts";
import { Input } from "@dev-template/ui/input";
import { Label } from "@dev-template/ui/label";
import type { ListSearch } from "#client/widgets/list-filters/model/list-search.ts";

export function DateFilterFields(props: {
  value: ListSearch;
  onChange: (value: ListSearch) => void;
}) {
  const id = useId();
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-from`}>{t("開始日")}</Label>
        <Input
          id={`${id}-from`}
          type="date"
          value={props.value.from ?? ""}
          max={props.value.to}
          onChange={(event) =>
            props.onChange({ ...props.value, from: event.target.value || undefined })
          }
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-to`}>{t("終了日")}</Label>
        <Input
          id={`${id}-to`}
          type="date"
          value={props.value.to ?? ""}
          min={props.value.from}
          onChange={(event) =>
            props.onChange({ ...props.value, to: event.target.value || undefined })
          }
        />
      </div>
    </>
  );
}

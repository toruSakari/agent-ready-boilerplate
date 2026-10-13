import { t } from "#client/shared/i18n/index.ts";
import { Badge } from "@dev-template/ui/badge";
import { Button } from "@dev-template/ui/button";

export function FilterChips(props: { conditions: string[]; clear: () => void }) {
  if (!props.conditions.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t("適用中の条件")}>
      {props.conditions.map((label) => (
        <Badge key={label} variant="secondary" className="max-w-full break-all whitespace-normal">
          {label}
        </Badge>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={props.clear}>
        {t("条件を解除")}
      </Button>
    </div>
  );
}

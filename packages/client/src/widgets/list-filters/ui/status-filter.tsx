import { t } from "#client/shared/i18n/index.ts";
import { Button } from "@dev-template/ui/button";

export function StatusFilter(props: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div role="group" aria-label={props.label} className="flex flex-wrap gap-2">
      {props.options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={props.value === option.value ? "default" : "outline"}
          aria-pressed={props.value === option.value}
          onClick={() => props.onChange(option.value)}
        >
          {t(option.label)}
        </Button>
      ))}
    </div>
  );
}

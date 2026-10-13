import { t as translate } from "@dev-template/client/i18n";
import { Button } from "@dev-template/ui/button";

export function ListPagination(props: {
  label: string;
  page: number;
  fetching: boolean;
  hasNextPage: boolean;
  previousPage: () => void;
  nextPage: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-t p-4" aria-label={props.label}>
      <Button
        variant="outline"
        disabled={props.page === 0 || props.fetching}
        onClick={props.previousPage}
      >
        {translate("前へ")}
      </Button>
      <span className="text-sm text-muted-foreground">
        {translate("{{page}}ページ", { page: props.page + 1 })}
      </span>
      <Button
        variant="outline"
        disabled={!props.hasNextPage || props.fetching}
        onClick={props.nextPage}
      >
        {translate("次へ")}
      </Button>
    </div>
  );
}

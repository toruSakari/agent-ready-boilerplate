import { Skeleton } from "@dev-template/ui/skeleton";
import { Card } from "@dev-template/ui/card";
import { t } from "#client/shared/i18n/index.ts";

const PREVIEW_ROWS = 5;

export function TableSkeleton(props: { columns: string[]; label?: string }) {
  return (
    <Card
      className="overflow-hidden"
      role="status"
      aria-label={props.label ?? t("一覧を読み込み中…")}
    >
      <span className="sr-only">{props.label ?? t("一覧を読み込み中…")}</span>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" aria-hidden="true">
          <thead className="border-b bg-muted/40">
            <tr>
              {props.columns.map((label) => (
                <th key={label} className="whitespace-nowrap p-4">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: PREVIEW_ROWS }, (_, row) => (
              <tr key={row} className="border-b">
                {props.columns.map((label) => (
                  <td key={label} className="p-4">
                    <Skeleton className="h-5 min-w-20" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-center gap-3 p-4">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
    </Card>
  );
}

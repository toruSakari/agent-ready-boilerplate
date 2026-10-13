import { t } from "@dev-template/client/i18n";
import { Skeleton } from "@dev-template/ui/skeleton";
import { Card } from "@dev-template/ui/card";

export function StockSkeleton(props: { editable?: boolean }) {
  const { editable = true } = props;

  return (
    <Card className="p-6" role="status" aria-label={t("在庫を読み込み中…")}>
      <span className="sr-only">{t("在庫を読み込み中…")}</span>
      <div aria-hidden="true">
        <Skeleton className="h-6 w-24" />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </div>
        {editable && (
          <div className="mt-6 space-y-4">
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-32" />
            </div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-36" />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

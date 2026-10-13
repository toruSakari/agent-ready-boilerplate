import { t } from "@dev-template/client/i18n";
import { Card } from "@dev-template/ui/card";
import { Skeleton } from "@dev-template/ui/skeleton";

export function StockHistorySkeleton() {
  return (
    <Card className="overflow-hidden" role="status" aria-label={t("在庫履歴を読み込み中…")}>
      <div className="space-y-2 border-b p-6">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="overflow-x-auto" aria-hidden="true">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-5 gap-4 border-b bg-muted/40 p-4">
            {["日時", "操作", "変更前 → 変更後", "変更理由", "担当者"].map((label) => (
              <span key={label} className="text-xs text-muted-foreground">
                {t(label)}
              </span>
            ))}
          </div>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="grid grid-cols-5 gap-4 border-b p-4">
              {Array.from({ length: 5 }, (_, column) => (
                <Skeleton key={column} className="h-4 w-3/4" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between p-4">
        <Skeleton className="h-9 w-16" />
        <Skeleton className="h-9 w-16" />
      </div>
    </Card>
  );
}

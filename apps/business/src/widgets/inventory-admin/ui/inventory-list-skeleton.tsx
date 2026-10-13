import { t } from "@dev-template/client/i18n";
import { Card } from "@dev-template/ui/card";
import { Skeleton } from "@dev-template/ui/skeleton";

export function InventoryListSkeleton() {
  return (
    <Card className="overflow-hidden" role="status" aria-label={t("在庫一覧を読み込み中…")}>
      <div className="overflow-x-auto" aria-hidden="true">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 border-b bg-muted/40 p-4">
            {["商品名", "SKU", "在庫数", "予約中", "購入可能", "操作"].map((label) => (
              <span key={label} className="text-xs text-muted-foreground">
                {t(label)}
              </span>
            ))}
          </div>
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] items-center gap-4 border-b p-4"
            >
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-8 w-20" />
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

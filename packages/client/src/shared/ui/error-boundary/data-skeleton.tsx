import { t as translate } from "#client/shared/i18n";
import { Skeleton } from "@dev-template/ui/skeleton";

/** 読み込み中の領域を示し、内容の長さを推測させずレイアウトの高さを確保する。 */
export function DataSkeleton(props: { label?: string }) {
  const { label = translate("データを読み込み中…") } = props;

  return (
    <div
      role="status"
      aria-label={label}
      className="grid gap-4 rounded-xl border border-border p-6"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="grid gap-4">
        <Skeleton className="h-6 w-2/5" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}

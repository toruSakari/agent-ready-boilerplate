import type { HTMLAttributes } from "react";
import { cn } from "@dev-template/ui/lib/cn";

// shadcn/ui公式Skeleton。利用側のclassNameで読み込み後の寸法へ合わせる。
export function Skeleton(inputProps: HTMLAttributes<HTMLDivElement>) {
  const { className, ...props } = inputProps;

  return <div className={cn("animate-pulse rounded-md bg-primary/10", className)} {...props} />;
}

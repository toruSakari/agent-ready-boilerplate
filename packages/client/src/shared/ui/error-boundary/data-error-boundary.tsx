import { Suspense } from "react";
import type { ReactNode } from "react";
import { DataSkeleton } from "#client/shared/ui/error-boundary/data-skeleton";
import { QueryErrorResetBoundary, useQueryClient } from "@tanstack/react-query";
import { CatchBoundary } from "@tanstack/react-router";
import { DataErrorFallback } from "#client/shared/ui/error-boundary/data-error-fallback";

/** 局所的な取得・描画の捕捉は公式CatchBoundaryへ委ね、スコープ変更時は解除する。 */
export function DataErrorBoundary(props: {
  children: ReactNode;
  loadingLabel?: string;
  loadingFallback?: ReactNode;
  resetKey?: string;
}) {
  const client = useQueryClient();
  return (
    <QueryErrorResetBoundary>
      <CatchBoundary
        getResetKey={() => props.resetKey ?? client}
        errorComponent={DataErrorFallback}
      >
        <Suspense fallback={props.loadingFallback ?? <DataSkeleton label={props.loadingLabel} />}>
          {props.children}
        </Suspense>
      </CatchBoundary>
    </QueryErrorResetBoundary>
  );
}

import { useQueryClient, useQueryErrorResetBoundary } from "@tanstack/react-query";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { ErrorFallback } from "#client/shared/ui/error-boundary/error-fallback";

/** 公式CatchBoundaryのresetと失敗クエリの再試行を接続し、更新操作は再実行しない。 */
export function DataErrorFallback(props: ErrorComponentProps) {
  const client = useQueryClient();
  const queryBoundary = useQueryErrorResetBoundary();
  return (
    <ErrorFallback
      error={props.error}
      reset={() => {
        queryBoundary.reset();
        void client.resetQueries({ predicate: (query) => query.state.status === "error" });
        props.reset();
      }}
    />
  );
}

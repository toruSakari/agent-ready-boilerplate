import { useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { ErrorFallback } from "#client/shared/ui/error-boundary/error-fallback";

/** 公式のdefaultErrorComponentから呼び出し、入口の照会も含めて再試行する。 */
export function RouteError(props: ErrorComponentProps) {
  const router = useRouter();
  return (
    <ErrorFallback error={props.error} reset={() => void router.invalidate().then(props.reset)} />
  );
}
